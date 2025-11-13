import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConversionProgress {
  step: string
  message: string
  progress: number
  voice_count?: number
  file_count?: number
  file_index?: number
  total_files?: number
  voice_index?: number
  total_voices?: number
  completed_conversions?: number
  total_conversions?: number
  elapsed_seconds?: number
  estimated_remaining_seconds?: number
  speed_seconds_per_file?: number
  result?: {
    download_filename?: string
    file_size_mb?: number
    total_files?: number
    total_conversions?: number
    success_count?: number
    failed_count?: number
    total_time_minutes?: number
    output_directory?: string
    results?: Array<{
      source_file: string
      voice_name: string
      output_file: string
      file_size_mb: number
      status: string
      error?: string
    }>
  }
}

function App() {
  const [cloneDataFile, setCloneDataFile] = useState<File | null>(null)
  const [sourceAudioFile, setSourceAudioFile] = useState<File | null>(null)
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<string[]>([])
  const [voices, setVoices] = useState<Array<{voice_id: string, name: string, language: string}>>([])
  
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState<ConversionProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // クローンJSONがアップロードされたらVoice一覧を抽出
  useEffect(() => {
    if (cloneDataFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          setVoices(json.voices || [])
          // デフォルトで全パターンを選択
          if (json.voices && json.voices.length > 0) {
            setSelectedVoiceIds(json.voices.map((v: any) => v.voice_id))
          }
        } catch (err) {
          setError('クローンJSONの読み込みに失敗しました')
        }
      }
      reader.readAsText(cloneDataFile)
    }
  }, [cloneDataFile])

  const startConversion = async () => {
    if (!cloneDataFile) {
      setError('クローンJSONをアップロードしてください')
      return
    }
    
    if (!sourceAudioFile) {
      setError('変換元音源をアップロードしてください')
      return
    }
    
    if (selectedVoiceIds.length === 0) {
      setError('Voiceパターンを選択してください')
      return
    }

    setIsConverting(true)
    setError(null)
    setProgress(null)

    try {
      const formData = new FormData()
      formData.append('clone_data', cloneDataFile)
      formData.append('source_audio', sourceAudioFile)
      // 複数voice_idをJSON文字列として送信
      formData.append('voice_ids', JSON.stringify(selectedVoiceIds))

      const response = await fetch('http://localhost:8002/api/convert/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('レスポンスの読み込みに失敗しました')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setProgress(data)

              if (data.step === 'error') {
                setError(data.message)
                setIsConverting(false)
              }

              if (data.step === 'completed') {
                setIsConverting(false)
              }
            } catch (e) {
              console.error('JSON parse error:', e)
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました')
      setIsConverting(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white gradient-background relative overflow-hidden">
      {/* フローグラデーション効果 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-1/4 left-0 w-full h-px flow-gradient"></div>
        <div className="absolute top-2/4 left-0 w-full h-px flow-gradient" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-3/4 left-0 w-full h-px flow-gradient" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-8">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-leivo-primary via-leivo-accent to-leivo-secondary bg-clip-text text-transparent">
            LeiVo
          </h1>
          <p className="text-xl text-zinc-400">Voice Transformation</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <motion.div
              className="w-3 h-3 rounded-full bg-leivo-primary"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="w-3 h-3 rounded-full bg-leivo-accent"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div
              className="w-3 h-3 rounded-full bg-leivo-secondary"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            />
          </div>
        </motion.div>

        {/* パラメータ入力フォーム */}
        {!isConverting && !progress?.result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-800/50 backdrop-blur-lg rounded-2xl p-8 border border-leivo-primary/20 shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-leivo-primary/20 flex items-center justify-center text-leivo-primary">
                1
              </span>
              変換設定
            </h2>

            <div className="space-y-6">
              {/* クローンJSONアップロード */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  クローンデータ（JSON）<span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setCloneDataFile(file)
                      setError(null)
                    }
                  }}
                  className="hidden"
                  id="clone-upload"
                />
                <label
                  htmlFor="clone-upload"
                  className="flex items-center justify-center w-full bg-zinc-700/50 border-2 border-dashed border-zinc-600 rounded-lg px-4 py-6 cursor-pointer hover:border-leivo-primary hover:bg-zinc-700/70 transition"
                >
                  <div className="text-center">
                    <svg className="mx-auto h-10 w-10 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-zinc-300 font-medium">
                      {cloneDataFile ? cloneDataFile.name : 'クリックしてJSONを選択'}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      TuoVoで生成したクローンデータ
                    </p>
                  </div>
                </label>
              </div>

              {/* Voice選択（JSONから読み込み後） */}
              {voices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Voiceパターン選択（複数可）<span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto bg-zinc-700/30 rounded-lg p-3 border border-zinc-600">
                    {voices.map((voice) => (
                      <label
                        key={voice.voice_id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-zinc-600/30 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVoiceIds.includes(voice.voice_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVoiceIds([...selectedVoiceIds, voice.voice_id])
                            } else {
                              setSelectedVoiceIds(selectedVoiceIds.filter(id => id !== voice.voice_id))
                            }
                          }}
                          className="w-4 h-4 rounded border-zinc-500 text-leivo-primary focus:ring-leivo-primary focus:ring-offset-zinc-800"
                        />
                        <span className="text-sm text-zinc-200">{voice.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    選択中: {selectedVoiceIds.length} / {voices.length}パターン
                  </div>
                </div>
              )}

              {/* 音源ファイルアップロード */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  変換元音源（WAV/MP3）<span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept=".wav,.mp3"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setSourceAudioFile(file)
                      setError(null)
                    }
                  }}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="flex items-center justify-center w-full bg-zinc-700/50 border-2 border-dashed border-zinc-600 rounded-lg px-4 py-6 cursor-pointer hover:border-leivo-accent hover:bg-zinc-700/70 transition"
                >
                  <div className="text-center">
                    <svg className="mx-auto h-10 w-10 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <p className="text-sm text-zinc-300 font-medium">
                      {sourceAudioFile ? sourceAudioFile.name : 'クリックして音源を選択'}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {sourceAudioFile && `${(sourceAudioFile.size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                  </div>
                </label>
              </div>

              {/* エラー表示 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400"
                >
                  ⚠️ {error}
                </motion.div>
              )}

              {/* 変換開始ボタン */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startConversion}
                disabled={isConverting || !cloneDataFile || !sourceAudioFile || selectedVoiceIds.length === 0}
                className="w-full bg-gradient-to-r from-leivo-primary via-leivo-accent to-leivo-secondary hover:from-leivo-secondary hover:via-leivo-accent hover:to-leivo-primary text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundSize: '200% 100%' }}
              >
                ✨ 変換開始 ({selectedVoiceIds.length}パターン)
              </motion.button>
            </div>

            {/* 注意事項 */}
            <div className="mt-8 p-4 bg-zinc-700/30 rounded-lg border border-zinc-600/50">
              <h3 className="text-sm font-semibold text-leivo-primary mb-2">📌 注意事項</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• 1. クローンJSON（TuoVoで生成）をアップロード</li>
                <li>• 2. 変換したい音源ファイルをアップロード</li>
                <li>• 3. 使用するVoiceパターンを選択</li>
                <li>• 処理完了後、変換済み音声をダウンロード可能</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* 進捗表示 */}
        <AnimatePresence>
          {isConverting && progress && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800/50 backdrop-blur-lg rounded-2xl p-8 border border-leivo-primary/20 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <motion.span
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-leivo-primary to-leivo-secondary flex items-center justify-center morphing-shape"
                >
                  ✨
                </motion.span>
                変換中
              </h2>

              {/* プログレスバー */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-leivo-primary">
                    {progress.step === 'converting' ? '変換実行中' : progress.step === 'model_loaded' ? 'モデル読込完了' : progress.step === 'files_loaded' ? 'ファイル検出完了' : '処理中'}
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {progress.progress}%
                  </span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-leivo-primary via-leivo-accent to-leivo-secondary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ backgroundSize: '200% 100%' }}
                  >
                    <div className="h-full w-full bg-white/20 flow-gradient"></div>
                  </motion.div>
                </div>
              </div>

              {/* メッセージ */}
              <div className="bg-zinc-700/30 rounded-lg p-4 mb-6 border border-zinc-600/50">
                <p className="text-zinc-300">{progress.message}</p>
              </div>

              {/* 詳細情報 */}
              <div className="grid grid-cols-2 gap-4">
                {progress.file_index !== undefined && progress.total_files !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4 border border-leivo-primary/30">
                    <div className="text-sm text-zinc-400">ファイル</div>
                    <div className="text-2xl font-bold text-leivo-primary">
                      {progress.file_index} / {progress.total_files}
                    </div>
                  </div>
                )}
                
                {progress.voice_index !== undefined && progress.total_voices !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4 border border-leivo-accent/30">
                    <div className="text-sm text-zinc-400">パターン</div>
                    <div className="text-2xl font-bold text-leivo-accent">
                      {progress.voice_index} / {progress.total_voices}
                    </div>
                  </div>
                )}

                {progress.completed_conversions !== undefined && progress.total_conversions !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4 border border-leivo-secondary/30">
                    <div className="text-sm text-zinc-400">完了数</div>
                    <div className="text-2xl font-bold text-leivo-secondary">
                      {progress.completed_conversions} / {progress.total_conversions}
                    </div>
                  </div>
                )}

                {progress.elapsed_seconds !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4">
                    <div className="text-sm text-zinc-400">経過時間</div>
                    <div className="text-2xl font-bold text-white">
                      {formatTime(progress.elapsed_seconds)}
                    </div>
                  </div>
                )}

                {progress.estimated_remaining_seconds !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4 border border-purple-500/30">
                    <div className="text-sm text-zinc-400">予測残り時間</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {formatTime(progress.estimated_remaining_seconds)}
                    </div>
                  </div>
                )}

                {progress.speed_seconds_per_file !== undefined && (
                  <div className="bg-zinc-700/20 rounded-lg p-4">
                    <div className="text-sm text-zinc-400">処理速度</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {progress.speed_seconds_per_file.toFixed(1)}秒/件
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 完了レポート */}
        <AnimatePresence>
          {progress?.result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-800/50 backdrop-blur-lg rounded-2xl p-8 border border-green-500/20 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-leivo-primary to-leivo-secondary flex items-center justify-center text-3xl morphing-shape"
                >
                  ✨
                </motion.div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  変換完了！
                </h2>
              </div>

              {/* ダウンロードボタン */}
              {progress.result.download_filename && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const url = `http://localhost:8002/api/download/${progress.result!.download_filename}`
                    window.open(url, '_blank')
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-300 mb-4"
                >
                  📥 変換済み音声をダウンロード ({progress.result.file_size_mb?.toFixed(1)} MB)
                </motion.button>
              )}

              {/* 新規変換ボタン */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProgress(null)
                  setCloneDataFile(null)
                  setSourceAudioFile(null)
                  setVoices([])
                  setSelectedVoiceIds([])
                }}
                className="w-full bg-gradient-to-r from-leivo-primary via-leivo-accent to-leivo-secondary hover:from-leivo-secondary hover:via-leivo-accent hover:to-leivo-primary text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-500"
                style={{ backgroundSize: '200% 100%' }}
              >
                🔄 新しい変換を開始
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
