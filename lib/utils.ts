import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from "uuid" // uuidv4 임포트

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateRoomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const validateNickname = (value: string) => {
  // Allow Unicode characters, letters, numbers, spaces, and common punctuation
  const unicodeRegex = /^[\p{L}\p{N}\p{Z}\p{P}]{1,30}$/u
  return unicodeRegex.test(value.trim())
}

export const validateRoomId = (value: string) => {
  // Room ID should be alphanumeric, 4-20 characters
  const roomRegex = /^[A-Za-z0-9]{4,20}$/
  return roomRegex.test(value.trim())
}

export const generateUserId = (): string => {
  if (typeof window === "undefined") {
    // 서버 사이드 렌더링 시에는 더미 ID 반환 또는 다른 처리
    return "server-id"
  }
  let userId = localStorage.getItem("userId")
  if (!userId) {
    userId = uuidv4()
    localStorage.setItem("userId", userId)
  }
  return userId
}