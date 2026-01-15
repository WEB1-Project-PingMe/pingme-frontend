import UserSettings from "./user-settings"

function Header() {
  return (
    <header className="h-[42px] sticky top-0 border-b flex items-center px-4 w-screen z-10">
      <h2 className="font-semibold text-lg">
        Ping<span className="text-green-500">ME</span>
      </h2>
      <section className="ml-auto">
        <UserSettings />
      </section>
    </header>
  )
}

export default Header
