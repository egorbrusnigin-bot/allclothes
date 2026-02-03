"use client";

import { Suspense } from "react";
import AuthModal from "./AuthModal";

export default function AuthModalWrapper() {
  return (
    <Suspense fallback={<div />}>
      <AuthModal />
    </Suspense>
  );
}
