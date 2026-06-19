import { redirect } from "next/navigation"

// /pools is now split into /lend (supply + DeepBook strategy) and /borrow.
export default function PoolsPage() {
  redirect("/lend")
}
