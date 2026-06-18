"use client"

import type React from "react"
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

// MIGRATED → Sui. This legacy Algorand (Pera) provider is DEAD — the live wallet
// provider is the @mysten/dapp-kit WalletProvider in components/providers.tsx.
// The @perawallet/connect dependency was removed; connect() now only uses the
// dev mock-address prompt. TODO(xorr): delete this file once nothing references
// useWallet().
type PeraCtor = new (...args: any[]) => { connect: () => Promise<string[]>; disconnect: () => Promise<void> }
const PeraWalletConnect: PeraCtor | null = null

type WalletContextType = {
  address: string | null
  isConnected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // hydrate from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("payease:algo:address")
    if (saved) setAddress(saved)
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      // Try real Pera first (always null now — kept for shape only)
      if (PeraWalletConnect) {
        const pera = new PeraWalletConnect()
        const accounts: string[] = await pera.connect()
        if (accounts && accounts.length > 0) {
          const addr = accounts[0]
          localStorage.setItem("payease:algo:address", addr)
          setAddress(addr)
          router.refresh()
          return
        }
      }
      // Fallback: simple prompt for a mock address (dev convenience)
      const mock = prompt("Enter Algorand address (dev/mock):")
      if (mock && mock.trim()) {
        localStorage.setItem("payease:algo:address", mock.trim())
        setAddress(mock.trim())
        router.refresh()
      }
    } catch (_) {
      // swallow and fall back to prompt
      const mock = prompt("Enter Algorand address (dev/mock):")
      if (mock && mock.trim()) {
        localStorage.setItem("payease:algo:address", mock.trim())
        setAddress(mock.trim())
        router.refresh()
      }
    } finally {
      setConnecting(false)
    }
  }, [router])

  const disconnect = useCallback(async () => {
    localStorage.removeItem("payease:algo:address")
    setAddress(null)
    router.push("/") // send back home
  }, [router])

  const value = useMemo(
    () => ({ address, isConnected: !!address, connecting, connect, disconnect }),
    [address, connecting, connect, disconnect],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}
