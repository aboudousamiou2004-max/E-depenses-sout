import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <div className="mesh-bg">
        <div className="blob" />
      </div>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pl-0">
        <div className="h-full overflow-y-auto pr-1 pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
