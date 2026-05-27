import { CreateRoomButton } from "@/components/CreateRoomButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f3f7f4] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div className="space-y-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-3 py-1 text-sm font-medium text-emerald-800 shadow-sm">
              WebRTC + Ably
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
                Meet
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                Create a private room, share the invite link, and start a
                peer-to-peer video call through your TURN server.
              </p>
            </div>
            <CreateRoomButton />
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-call">
            <div className="aspect-[4/3] overflow-hidden rounded-[8px] bg-slate-950">
              <div className="grid h-full grid-cols-2 gap-2 p-3">
                <div className="relative overflow-hidden rounded-[8px] bg-gradient-to-br from-emerald-300 to-cyan-600">
                  <div className="absolute bottom-3 left-3 h-2 w-20 rounded-full bg-white/80" />
                </div>
                <div className="relative overflow-hidden rounded-[8px] bg-gradient-to-br from-amber-200 to-rose-500">
                  <div className="absolute bottom-3 left-3 h-2 w-16 rounded-full bg-white/80" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>1-on-1 room</span>
              <span>TURN ready</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
