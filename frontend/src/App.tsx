import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceModel {
  model_name: string
  fine_tune_id: string
  language: string
  voice_count: number
  voices: Array<{
    voice_id: string
    name: string
    language: string
  }>
  created_at: string
  segment_count?: number
  training_time_minutes?: number
}

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
    total_files: number
    total_conversions: number
    success_count: number
    failed_count: number
    total_time_minutes: number
    output_directory: string
    results: Array<{
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
  const [models, setModels] = useState<VoiceModel[]>([])
  const [selectedModel, setSelectedModel] = useState<VoiceModel | null>(null)
  const [sourceAudioDirectory, setSourceAudioDirectory] = useState('F:/Tuo vo/source_audio')
  const [outputDirectory, setOutputDirectory] = useState('F:/Tuo vo/ChangeData')
  
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState<ConversionProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // モデル一覧を取得
  useEffect(() => {
    fetch('http://localhost:8002/api/models')
      .then(res => res.json())
      .then(data => {
        setModels(data.models)
        if (data.models.length > 0) {
          setSelectedModel(data.models[0])
        }
      })
      .catch(err => console.error('モデル取得エラー:', err))
  }, [])

  const startConversion = async () => {
    if (!selectedModel) {
      setError('モデルを選択してください')
      return
    }

    setIsConverting(true)
    setError(null)
    setProgress(null)

    try {
      const response = await fetch('http://localhost:8002/api/convert/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: selectedModel.model_name,
          source_audio_directory: sourceAudioDirectory,
          output_directory: outputDirectory
        })
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
              {/* モデル選択 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Voiceモデル選択 <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedModel?.model_name || ''}
                  onChange={(e) => {
                    const model = models.find(m => m.model_name === e.target.value)
                    setSelectedModel(model || null)
                  }}
                  className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-leivo-primary focus:border-transparent transition"
                >
                  {models.length === 0 ? (
                    <option>モデルを読み込み中...</option>
                  ) : (
                    models.map((model) => (
                      <option key={model.model_name} value={model.model_name}>
                        {model.model_name} ({model.voice_count}パターン)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 選択モデルの詳細 */}
              {selectedModel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-zinc-700/30 rounded-lg p-4 border border-zinc-600/50"
                >
                  <h3 className="text-sm font-semibold text-leivo-primary mb-3">
                    📊 選択中のモデル詳細
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-zinc-400">パターン数:</span>
                      <span className="ml-2 text-white font-semibold">{selectedModel.voice_count}個</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">言語:</span>
                      <span className="ml-2 text-white font-semibold">{selectedModel.language}</span>
                    </div>
                    {selectedModel.segment_count && (
                      <div>
                        <span className="text-zinc-400">セグメント:</span>
                        <span className="ml-2 text-white font-semibold">{selectedModel.segment_count}個</span>
                      </div>
                    )}
                    {selectedModel.training_time_minutes && (
                      <div>
                        <span className="text-zinc-400">学習時間:</span>
                        <span className="ml-2 text-white font-semibold">{selectedModel.training_time_minutes.toFixed(1)}分</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Voiceパターン一覧 */}
                  <div className="mt-4">
                    <div className="text-xs text-zinc-400 mb-2">変換パターン:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.voices.map((voice) => (
                        <span
                          key={voice.voice_id}
                          className="px-2 py-1 bg-leivo-primary/20 border border-leivo-primary/40 rounded text-xs text-leivo-primary"
                        >
                          {voice.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 音源ディレクトリ */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  変換元音源ディレクトリ <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={sourceAudioDirectory}
                  onChange={(e) => setSourceAudioDirectory(e.target.value)}
                  placeholder="F:/Tuo vo/source_audio"
                  className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-leivo-primary focus:border-transparent transition font-mono text-sm"
                />
              </div>

              {/* 出力先 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  出力先ディレクトリ
                </label>
                <input
                  type="text"
                  value={outputDirectory}
                  onChange={(e) => setOutputDirectory(e.target.value)}
                  className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-leivo-primary focus:border-transparent transition font-mono text-sm"
                />
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
                disabled={isConverting || !selectedModel}
                className="w-full bg-gradient-to-r from-leivo-primary via-leivo-accent to-leivo-secondary hover:from-leivo-secondary hover:via-leivo-accent hover:to-leivo-primary text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundSize: '200% 100%' }}
              >
                ✨ 変換開始
              </motion.button>
            </div>

            {/* 注意事項 */}
            <div className="mt-8 p-4 bg-zinc-700/30 rounded-lg border border-zinc-600/50">
              <h3 className="text-sm font-semibold text-leivo-primary mb-2">📌 注意事項</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• 選択したモデルの全パターンで変換されます</li>
                <li>• ディレクトリ内の全WAVファイルが対象になります</li>
                <li>• 出力ファイル名: {'{モデル名}_{パターン名}_{元音源名}.wav'}</li>
                <li>• 処理時間は音源の長さとパターン数に比例します</li>
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

              {/* サマリー */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-700/30 rounded-lg p-4 border border-green-500/30">
                  <div className="text-sm text-zinc-400 mb-1">成功</div>
                  <div className="text-3xl font-bold text-green-400">
                    {progress.result.success_count}
                  </div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-4 border border-leivo-primary/30">
                  <div className="text-sm text-zinc-400 mb-1">音源数</div>
                  <div className="text-3xl font-bold text-leivo-primary">
                    {progress.result.total_files}
                  </div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-4 border border-leivo-accent/30">
                  <div className="text-sm text-zinc-400 mb-1">処理時間</div>
                  <div className="text-3xl font-bold text-leivo-accent">
                    {progress.result.total_time_minutes.toFixed(1)}分
                  </div>
                </div>
              </div>

              {/* 変換結果一覧 */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4 text-leivo-primary">変換結果</h3>
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {progress.result.results.map((result, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`rounded-lg p-3 border ${
                        result.status === 'success'
                          ? 'bg-green-900/20 border-green-500/30'
                          : 'bg-red-900/20 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between text-sm">
                        <div className="flex-1">
                          <div className="font-semibold text-white">
                            {result.source_file} → {result.voice_name}
                          </div>
                          {result.status === 'success' ? (
                            <div className="text-xs text-zinc-400 mt-1 font-mono">
                              {result.file_size_mb.toFixed(1)}MB
                            </div>
                          ) : (
                            <div className="text-xs text-red-400 mt-1">
                              {result.error}
                            </div>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${
                          result.status === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {result.status === 'success' ? '✓' : '✗'}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 保存先情報 */}
              <div className="bg-zinc-700/30 rounded-lg p-4 border border-zinc-600/50 mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">💾 保存先</h3>
                <div className="text-sm text-white font-mono break-all">
                  {progress.result.output_directory}
                </div>
              </div>

              {/* 新規変換ボタン */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProgress(null)
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
