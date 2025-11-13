"""
LeiVo Backend API
Cartesia Voice Conversion のための FastAPI アプリケーション
"""
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from pathlib import Path
import json
import os
import requests
import time
import asyncio
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LeiVo API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5175"],  # Vite開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# パス設定
BASE_DIR = Path("F:/Tuo vo")
CLONE_DATA_DIR = Path("C:/Users/dokog/OneDrive/仕事/アプリ制作/CloneData")
CHANGE_DATA_DIR = BASE_DIR / "ChangeData"
TEMP_DIR_BASE = Path("temp_leivo")

# Cartesia API設定
API_KEY = os.getenv("CARTESIA_API_KEY")
BASE_URL = "https://api.cartesia.ai"
API_VERSION = "2025-04-16"


class ConversionRequest(BaseModel):
    """音声変換リクエスト"""
    model_name: str
    source_audio_directory: str
    output_directory: str = str(CHANGE_DATA_DIR)


@app.get("/")
async def root():
    """ヘルスチェック"""
    return {"status": "ok", "service": "LeiVo API"}


@app.get("/api/models")
async def get_models():
    """
    利用可能なモデル一覧を取得
    """
    models = []
    
    # CloneDataディレクトリから*_pro_info.jsonファイルを再帰検索
    for json_file in CLONE_DATA_DIR.rglob("voice_clone_*_pro_info.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
            
            # モデル名を抽出
            model_name = info.get('model_name', json_file.stem.replace('voice_clone_', '').replace('_pro_info', ''))
            
            models.append({
                "model_name": model_name,
                "fine_tune_id": info.get('fine_tune_id'),
                "language": info.get('language', 'ja'),
                "voice_count": info.get('voice_count', len(info.get('voices', []))),
                "voices": info.get('voices', []),
                "created_at": info.get('created_at'),
                "segment_count": info.get('segment_count'),
                "training_time_minutes": info.get('training_time_minutes')
            })
        except Exception as e:
            print(f"Error loading {json_file}: {e}")
    
    return {"models": models}


@app.post("/api/convert/batch")
async def batch_convert(request: ConversionRequest):
    """
    バッチ音声変換を実行（SSE）
    """
    async def generate_progress():
        start_time = time.time()
        
        try:
            # ステップ0: 初期化とモデル情報取得
            yield f"data: {json.dumps({'step': 'initializing', 'message': '初期化中...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)
            
            # モデル情報を読み込み（再帰検索）
            model_name_lower = request.model_name.lower().replace(' ', '_')
            model_json_pattern = f"voice_clone_{model_name_lower}_pro_info.json"
            model_json_files = list(CLONE_DATA_DIR.rglob(model_json_pattern))
            
            if not model_json_files:
                yield f"data: {json.dumps({'step': 'error', 'message': f'モデル情報が見つかりません: {model_json_pattern}'})}\n\n"
                return
            
            # 最初に見つかったファイルを使用
            model_json = model_json_files[0]
            
            with open(model_json, 'r', encoding='utf-8') as f:
                model_info = json.load(f)
            
            voices = model_info.get('voices', [])
            
            if not voices:
                yield f"data: {json.dumps({'step': 'error', 'message': 'Voiceモデルが見つかりません'})}\n\n"
                return
            
            yield f"data: {json.dumps({
                'step': 'model_loaded',
                'message': f'{len(voices)}個のVoiceモデルを読み込み',
                'voice_count': len(voices),
                'progress': 5
            })}\n\n"
            await asyncio.sleep(0.5)
            
            # ステップ1: 音源ファイル取得
            source_dir = Path(request.source_audio_directory)
            if not source_dir.exists():
                yield f"data: {json.dumps({'step': 'error', 'message': f'音源ディレクトリが見つかりません: {source_dir}'})}\n\n"
                return
            
            # WAVファイルを検索
            source_files = list(source_dir.glob("*.wav"))
            
            if not source_files:
                yield f"data: {json.dumps({'step': 'error', 'message': '音源ファイル（WAV）が見つかりません'})}\n\n"
                return
            
            yield f"data: {json.dumps({
                'step': 'files_loaded',
                'message': f'{len(source_files)}個の音源ファイルを検出',
                'file_count': len(source_files),
                'progress': 10
            })}\n\n"
            await asyncio.sleep(0.5)
            
            # ステップ2: 変換実行
            output_dir = Path(request.output_directory) / request.model_name
            output_dir.mkdir(parents=True, exist_ok=True)
            
            total_conversions = len(source_files) * len(voices)
            completed_conversions = 0
            results = []
            
            conversion_start = time.time()
            
            # Voice Changer API用ヘッダー（Bearer認証）
            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Cartesia-Version": API_VERSION
            }
            
            for file_idx, source_file in enumerate(source_files, 1):
                # 音声ファイルを読み込み
                print(f"📁 ファイル読み込み: {source_file}")
                with open(source_file, 'rb') as f:
                    audio_data = f.read()
                print(f"   サイズ: {len(audio_data) / (1024*1024):.1f}MB")
                
                for voice_idx, voice in enumerate(voices, 1):
                    voice_id = voice.get('voice_id')
                    voice_name = voice.get('name', f'Voice-{voice_idx}')
                    
                    # 進捗更新（API呼び出し前）
                    progress_before = 10 + int((completed_conversions / total_conversions) * 85)
                    yield f"data: {json.dumps({
                        'step': 'converting',
                        'message': f'{source_file.name} を {voice_name} で変換中... (処理には数分かかる場合があります)',
                        'progress': progress_before,
                        'file_index': file_idx,
                        'total_files': len(source_files),
                        'voice_index': voice_idx,
                        'total_voices': len(voices),
                        'completed_conversions': completed_conversions,
                        'total_conversions': total_conversions
                    })}\n\n"
                    await asyncio.sleep(0.1)
                    
                    print(f"🔄 変換開始: {source_file.name} → {voice_name}")
                    
                    try:
                        # Voice Changer API呼び出し
                        url = f"{BASE_URL}/voice-changer/bytes"
                        
                        files = {
                            'clip': (source_file.name, audio_data, 'audio/wav')
                        }
                        
                        data = {
                            'voice[id]': voice_id,
                            'output_format[container]': 'wav',
                            'output_format[sample_rate]': '44100',
                            'output_format[encoding]': 'pcm_s16le'
                        }
                        
                        response = requests.post(url, headers=headers, files=files, data=data, timeout=300)
                        
                        if response.status_code == 200:
                            # 出力ファイル名: {モデル名}_{パターン名}_{元音源名}.wav
                            output_filename = f"{request.model_name}_{voice_name.replace(' - ', '-')}_{source_file.stem}.wav"
                            output_path = output_dir / output_filename
                            
                            with open(output_path, 'wb') as f:
                                f.write(response.content)
                            
                            file_size_mb = len(response.content) / 1024 / 1024
                            
                            results.append({
                                "source_file": source_file.name,
                                "voice_name": voice_name,
                                "output_file": str(output_path),
                                "file_size_mb": round(file_size_mb, 1),
                                "status": "success"
                            })
                        else:
                            results.append({
                                "source_file": source_file.name,
                                "voice_name": voice_name,
                                "status": "failed",
                                "error": f"API error: {response.status_code}"
                            })
                    
                    except Exception as e:
                        results.append({
                            "source_file": source_file.name,
                            "voice_name": voice_name,
                            "status": "failed",
                            "error": str(e)
                        })
                    
                    completed_conversions += 1
                    
                    # 進捗更新
                    elapsed_seconds = time.time() - conversion_start
                    avg_time_per_conversion = elapsed_seconds / completed_conversions if completed_conversions > 0 else 0
                    remaining_conversions = total_conversions - completed_conversions
                    estimated_remaining_seconds = avg_time_per_conversion * remaining_conversions
                    
                    progress = 10 + int((completed_conversions / total_conversions) * 85)
                    
                    yield f"data: {json.dumps({
                        'step': 'converting',
                        'message': f'{source_file.name} を {voice_name} で変換中...',
                        'progress': progress,
                        'file_index': file_idx,
                        'total_files': len(source_files),
                        'voice_index': voice_idx,
                        'total_voices': len(voices),
                        'completed_conversions': completed_conversions,
                        'total_conversions': total_conversions,
                        'elapsed_seconds': round(elapsed_seconds, 1),
                        'estimated_remaining_seconds': round(estimated_remaining_seconds, 1),
                        'speed_seconds_per_file': round(avg_time_per_conversion, 1)
                    })}\n\n"
                    await asyncio.sleep(0.1)
            
            # 完了
            total_time = time.time() - start_time
            success_count = len([r for r in results if r['status'] == 'success'])
            failed_count = len([r for r in results if r['status'] == 'failed'])
            
            yield f"data: {json.dumps({
                'step': 'completed',
                'message': '変換完了！',
                'progress': 100,
                'result': {
                    'total_files': len(source_files),
                    'total_conversions': total_conversions,
                    'success_count': success_count,
                    'failed_count': failed_count,
                    'total_time_minutes': round(total_time / 60, 1),
                    'output_directory': str(output_dir),
                    'results': results
                }
            })}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e), 'progress': 0})}\n\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/convert/upload")
async def convert_with_upload(
    clone_data: UploadFile = File(...),
    source_audio: UploadFile = File(...),
    voice_ids: str = Form(...)  # JSON文字列として受け取る
):
    """
    クローンJSONと音源をアップロードして変換→ダウンロード
    複数Voiceパターンで変換可能
    """
    async def generate_progress():
        temp_dir = None
        
        try:
            import uuid
            import zipfile
            
            session_id = str(uuid.uuid4())[:8]
            temp_dir = TEMP_DIR_BASE / f"convert_{session_id}"
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # voice_idsをパース
            voice_id_list = json.loads(voice_ids)
            if not isinstance(voice_id_list, list):
                voice_id_list = [voice_id_list]
            
            # クローンデータJSON読み込み
            yield f"data: {json.dumps({'step': 'initializing', 'message': 'クローンデータ読込中...', 'progress': 5})}\n\n"
            await asyncio.sleep(0.1)
            
            clone_content = await clone_data.read()
            model_info = json.loads(clone_content)
            
            # 音源ファイル保存
            yield f"data: {json.dumps({'step': 'saving_audio', 'message': '音源ファイル保存中...', 'progress': 10})}\n\n"
            await asyncio.sleep(0.1)
            
            source_content = await source_audio.read()
            
            # 複数パターンで変換
            total_patterns = len(voice_id_list)
            converted_files = []
            
            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Cartesia-Version": API_VERSION
            }
            
            for idx, voice_id in enumerate(voice_id_list, 1):
                # Voice名を取得
                voice_info = next((v for v in model_info.get('voices', []) if v.get('voice_id') == voice_id), None)
                voice_name = voice_info.get('name', f'Voice-{idx}') if voice_info else f'Voice-{idx}'
                
                progress_val = 10 + int((idx / total_patterns) * 80)
                yield f"data: {json.dumps({
                    'step': 'converting',
                    'message': f'{voice_name}で変換中... ({idx}/{total_patterns})',
                    'progress': progress_val,
                    'voice_index': idx,
                    'total_voices': total_patterns
                })}\n\n"
                await asyncio.sleep(0.1)
                
                url = f"{BASE_URL}/voice-changer/bytes"
                
                files = {
                    'clip': (source_audio.filename, source_content, 'audio/wav')
                }
                
                data = {
                    'voice[id]': voice_id,
                    'output_format[container]': 'wav',
                    'output_format[sample_rate]': '44100',
                    'output_format[encoding]': 'pcm_s16le'
                }
                
                response = requests.post(url, headers=headers, files=files, data=data, timeout=300)
                
                if response.status_code == 200:
                    output_filename = f"{voice_name.replace(' - ', '-')}_{source_audio.filename}"
                    output_path = temp_dir / output_filename
                    
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    
                    converted_files.append(output_filename)
            
            # ZIPファイル作成（複数の場合）
            if len(converted_files) > 1:
                zip_filename = f"converted_{Path(source_audio.filename).stem}.zip"
                zip_path = temp_dir / zip_filename
                
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for filename in converted_files:
                        file_path = temp_dir / filename
                        zipf.write(file_path, filename)
                
                download_filename = zip_filename
                file_size = zip_path.stat().st_size
            else:
                download_filename = converted_files[0]
                file_size = (temp_dir / download_filename).stat().st_size
            
            yield f"data: {json.dumps({
                'step': 'completed',
                'message': '変換完了！',
                'progress': 100,
                'result': {
                    'download_filename': download_filename,
                    'file_size_mb': round(file_size / 1024 / 1024, 1),
                    'pattern_count': len(converted_files)
                }
            })}\n\n"
            
        except Exception as e:
            import traceback
            print(f"ERROR: {traceback.format_exc()}")
            yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/download/{filename}")
async def download_converted_audio(filename: str):
    """
    変換済み音声をダウンロード
    """
    # 一時ディレクトリから検索
    for temp_dir in TEMP_DIR_BASE.glob("convert_*"):
        file_path = temp_dir / filename
        if file_path.exists():
            return FileResponse(
                path=str(file_path),
                filename=filename,
                media_type="audio/wav"
            )
    
    raise HTTPException(status_code=404, detail="ファイルが見つかりません")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
