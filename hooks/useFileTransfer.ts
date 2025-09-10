import { useState, useCallback, useRef } from 'react'

const CHUNK_SIZE = 64 * 1024 // 64KB 청크 크기

export interface FileState {
  id: string
  name: string
  size: number
  type: string
  status: 'sending' | 'receiving' | 'completed' | 'failed' | 'uploading' // 'uploading' 추가
  progress: number
  url?: string // 다운로드용 URL
  rawChunks?: ArrayBuffer[] // 수신 중인 청크 데이터
}

interface UseFileTransferProps {
  sendData: (data: any) => boolean
}

export function useFileTransfer({ sendData }: UseFileTransferProps) {
  const [files, setFiles] = useState<Record<string, FileState>>({})

  // 파일 전송 시작 함수 (파일을 청크로 분할하여 전송)
  const sendFile = useCallback(
    async (file: File) => {
      const fileId = `${Date.now()}-${file.name}`
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

      // 파일 상태 초기화
      const initialFileState: FileState = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'sending',
        progress: 0,
      }
      setFiles((prev) => ({ ...prev, [fileId]: initialFileState }))

      // 1. 파일 전송 시작 알림
      sendData(JSON.stringify({
        type: 'file-start',
        payload: { id: fileId, name: file.name, size: file.size, type: file.type },
      }))

      // 2. 파일을 읽고 청크로 나누어 전송
      const reader = new FileReader()
      let offset = 0

      reader.onload = (e) => {
        if (e.target?.result) {
          const chunk = e.target.result as ArrayBuffer
          sendData(chunk) // 바이너리 데이터 직접 전송

          offset += chunk.byteLength
          const progress = Math.round((offset / file.size) * 100)
          setFiles((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], progress },
          }))

          if (offset < file.size) {
            readNextChunk()
          } else {
            // 3. 파일 전송 완료 알림
            sendData(JSON.stringify({ type: 'file-end', payload: { id: fileId } }))
            setFiles((prev) => ({
              ...prev,
              [fileId]: { ...prev[fileId], status: 'completed', progress: 100 },
            }))
          }
        }
      }

      reader.onerror = () => {
        console.error('File read error')
        setFiles((prev) => ({ ...prev, [fileId]: { ...prev[fileId], status: 'failed' } }))
      }

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE)
        reader.readAsArrayBuffer(slice)
      }

      readNextChunk()
    },
    [sendData]
  )

  // 수신된 데이터 처리 함수 (파일 조립)
  const handleData = useCallback((data: any) => {
    if (typeof data === 'string') {
      const message = JSON.parse(data)
      const { type, payload } = message
      const { id } = payload

      if (type === 'file-start') {
        setFiles((prev) => ({
          ...prev,
          [id]: {
            ...payload,
            status: 'receiving',
            progress: 0,
            rawChunks: [],
          },
        }))
      } else if (type === 'file-end') {
        setFiles((prev) => {
          const fileState = prev[id]
          if (fileState && fileState.rawChunks) {
            const fileBlob = new Blob(fileState.rawChunks, { type: fileState.type })
            const url = URL.createObjectURL(fileBlob)
            return {
              ...prev,
              [id]: { ...fileState, status: 'completed', progress: 100, url, rawChunks: [] },
            }
          }
          return prev
        })
      }
    } else if (data instanceof ArrayBuffer) {
      // 청크 데이터는 가장 최근에 시작된 파일에 추가
      const receivingFileId = Object.keys(files).find(id => files[id].status === 'receiving' && !files[id].url)
      if (receivingFileId) {
        setFiles((prev) => {
          const fileState = prev[receivingFileId]
          const newChunks = [...(fileState.rawChunks || []), data]
          const receivedSize = newChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
          const progress = Math.round((receivedSize / fileState.size) * 100)

          return {
            ...prev,
            [receivingFileId]: { ...fileState, rawChunks: newChunks, progress },
          }
        })
      }
    }
  }, [files])

  return { files: Object.values(files), sendFile, handleData }
}