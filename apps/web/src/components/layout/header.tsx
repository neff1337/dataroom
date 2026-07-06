"use client";

import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <header className="flex flex-row items-center justify-between px-3 py-2">
      <Link className="font-semibold" href="/">
        Data Room
      </Link>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
