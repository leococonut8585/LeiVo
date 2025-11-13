# LeiVo - Voice Transformation

Cartesia APIを使用した音声変換アプリケーション

## 🎯 概要

LeiVoは、Cartesia Voice Changer APIを使用して、既存の音声クローンモデルで音声を変換するWebアプリケーションです。

### 主な機能

- 🎭 **モデル自動検出**: CloneDataディレクトリから利用可能なモデルを自動検出
- 🔄 **全パターン変換**: 選択したモデルの全Voiceパターン（V0, V1, V2, V3等）で一括変換
- 📊 **リアルタイム進捗表示**: SSEによる変換進捗とETA（予測残り時間）の表示
- ✅ **完了レポート**: 成功/失敗数、各ファイルの詳細情報を表示
- 💾 **自動保存**: ファイル名規則に従って自動保存（`{モデル名}_{パターン名}_{元音源名}.wav`）

## 🛠️ 技術スタック

### Backend
- **FastAPI**: Web API
- **Python 3.10+**
- **Cartesia Voice Changer API**: (API Version 2025-04-16)

### Frontend
- **React 18 + TypeScript**: UIフレームワーク
- **Vite 5**: ビルドツール
- **Tailwind CSS 3**: スタイリング
- **Motion (motion.dev)**: アニメーション

## 📋 必要条件

- **Python**: 3.10以上
- **Node.js**: 18以上
- **Cartesia APIキー**: `CARTESIA_API_KEY`
- **既存のVoiceモデル**: TuoVoで作成したモデル、または既存のモデル情報JSON

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/leococonut8585/LeiVo.git
cd LeiVo
```

### 2. バックエンドのセットアップ

```bash
cd backend
pip install -r requirements.txt
```

### 3. 環境変数の設定

`backend/.env`ファイルにCartesia APIキーを設定：

```
CARTESIA_API_KEY=your_api_key_here
```

### 4. フロントエンドのセットアップ

```bash
cd ../frontend
npm install
```

## 🎬 起動方法

### 方法1: 起動スクリプト（推奨）

```bash
start.bat
```

### 方法2: 個別起動

**バックエンド**:
```bash
cd backend
python api.py
```

**フロントエンド**:
```bash
cd frontend
npm run dev
```

## 🌐 アクセス

- **Frontend**: http://localhost:5175
- **Backend API**: http://localhost:8002
- **API Docs**: http://localhost:8002/docs

## 📖 使い方

### 1. モデル選択

- アプリ起動時に利用可能なモデルが自動的に読み込まれます
- ドロップダウンからモデルを選択
- 選択したモデルの全Voiceパターンが表示されます

### 2. パラメータ設定

- **変換元音源ディレクトリ**: 変換したいWAVファイルが入ったフォルダ
- **出力先ディレクトリ**: 変換後のファイルを保存するフォルダ（デフォルト: `F:/Tuo vo/ChangeData`）

### 3. 変換開始

「✨ 変換開始」ボタンをクリックして変換を開始します。

### 4. 進捗確認

変換中は以下の情報がリアルタイムで表示されます：

- 現在処理中のファイルとパターン
- 完了数/総変換数
- 経過時間
- 予測残り時間
- 処理速度（秒/件）

### 5. 完了レポート

変換完了後、以下の情報が表示されます：

- 成功/失敗数
- 各変換の詳細（元ファイル、Voiceパターン、出力パス、ファイルサイズ）
- 合計処理時間
- 保存先ディレクトリ

## 📁 出力ファイル

変換後、以下の形式でファイルが生成されます：

```
F:/Tuo vo/ChangeData/{モデル名}/
├── {モデル名}_{パターン名}_{元音源名1}.wav
├── {モデル名}_{パターン名}_{元音源名2}.wav
└── ...
```

例:
```
F:/Tuo vo/ChangeData/Singha/
├── Singha_V0_audio1.wav
├── Singha_V1_audio1.wav
├── Singha_V2_audio1.wav
├── Singha_V3_audio1.wav
├── Singha_V0_audio2.wav
└── ...
```

## ⚙️ API仕様

### GET /api/models

利用可能なモデル一覧を取得

**Response:**
```json
{
  "models": [
    {
      "model_name": "Singha",
      "fine_tune_id": "fine_tune_xxx",
      "language": "ja",
      "voice_count": 4,
      "voices": [...],
      "created_at": "2025-11-02T03:35:01.835202Z"
    }
  ]
}
```

### POST /api/convert/batch

バッチ音声変換を実行（SSE）

**Request:**
```json
{
  "model_name": "Singha",
  "source_audio_directory": "F:/Tuo vo/source_audio",
  "output_directory": "F:/Tuo vo/ChangeData"
}
```

**Response:** Server-Sent Events (SSE) stream

## 🎨 UIテーマ

**LeiVo - 変身**
- カラースキーム: パープル/マゼンタ系
- アニメーション: モーフィング、フローグラデーション
- フォント: Poppins, Nunito

## 📝 注意事項

- 選択したモデルの**全パターン**で変換されます
- ディレクトリ内の**全WAVファイル**が対象になります
- 処理時間は音源の長さとパターン数に比例します
- 変換中はブラウザを閉じないでください

## 🔧 トラブルシューティング

### モデルが表示されない

CloneDataディレクトリに`voice_clone_*_pro_info.json`ファイルが存在するか確認してください。

### Backend起動時のエラー

```bash
# 依存関係の再インストール
cd backend
pip install -r requirements.txt --force-reinstall
```

### Frontend起動時のエラー

```bash
# node_modulesの削除と再インストール
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### APIキーエラー

`.env`ファイルが正しく設定されているか確認してください。

## 📄 ライセンス

MIT License

## 🤝 貢献

Pull Requestsは歓迎します！

## 📞 サポート

Issue: https://github.com/leococonut8585/LeiVo/issues

---

**Created with ❤️ by Cline AI Assistant**
