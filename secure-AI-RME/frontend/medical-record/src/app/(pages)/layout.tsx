import Sidebar from "../../components/sidebar";
import Header from "../../components/header";
import "../globals.css"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#FDFEF9] w-full ">
      <aside className="w-68 fixed h-full">
        <Sidebar />
      </aside>

      <main className="flex-1 ml-65 flex flex-col px-10 mt-5">
        <Header /> 
        <div className="pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
