import Sidebar from "../../components/sidebar";
import Header from "../../components/header";
import "../globals.css"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#FDFEF9] w-full ">
      <aside className="lg:w-64 fixed h-full z-40">
        <Sidebar />
      </aside>

      <main className="flex-1 flex flex-col px-4 md:px-10 mt-5 lg:mt-5 lg:ml-64 transition-all duration-300">         <Header />
        <div className="pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
