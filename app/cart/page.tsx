"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CartDrawer from "../components/CartDrawer";

export default function CartPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Open drawer on mount
    setIsDrawerOpen(true);
  }, []);

  const handleClose = () => {
    setIsDrawerOpen(false);
    // Navigate back after closing animation
    setTimeout(() => {
      router.back();
    }, 300);
  };

  // Return just the drawer without any page content
  return <CartDrawer isOpen={isDrawerOpen} onClose={handleClose} />;
}
