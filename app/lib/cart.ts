export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  brandName: string;
  price: number;
  currency: string;
  size: string;
  quantity: number;
  imageUrl: string;
}

const CART_STORAGE_KEY = "allclothes_cart";
const RECENTLY_VIEWED_KEY = "allclothes_recently_viewed";

/**
 * Get cart items from localStorage
 */
export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const cartData = localStorage.getItem(CART_STORAGE_KEY);
    if (!cartData) return [];
    return JSON.parse(cartData);
  } catch (error) {
    console.error("Error loading cart:", error);
    return [];
  }
}

/**
 * Save cart items to localStorage
 */
export function saveCartItems(items: CartItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    // Dispatch event for other components to listen
    window.dispatchEvent(new Event("cartUpdated"));
  } catch (error) {
    console.error("Error saving cart:", error);
  }
}

/**
 * Add item to cart
 */
export function addToCart(item: CartItem): boolean {
  try {
    const cart = getCartItems();

    // Check if item with same product and size already exists
    const existingIndex = cart.findIndex(
      (i) => i.productId === item.productId && i.size === item.size
    );

    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].quantity += item.quantity;
    } else {
      // Add new item
      cart.push(item);
    }

    saveCartItems(cart);
    return true;
  } catch (error) {
    console.error("Error adding to cart:", error);
    return false;
  }
}

/**
 * Remove item from cart
 */
export function removeFromCart(productId: string, size: string): boolean {
  try {
    const cart = getCartItems();
    const filtered = cart.filter(
      (item) => !(item.productId === productId && item.size === size)
    );
    saveCartItems(filtered);
    return true;
  } catch (error) {
    console.error("Error removing from cart:", error);
    return false;
  }
}

/**
 * Update item quantity
 */
export function updateCartItemQuantity(
  productId: string,
  size: string,
  quantity: number
): boolean {
  try {
    const cart = getCartItems();
    const itemIndex = cart.findIndex(
      (i) => i.productId === productId && i.size === size
    );

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        cart.splice(itemIndex, 1);
      } else {
        cart[itemIndex].quantity = quantity;
      }
      saveCartItems(cart);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating cart item:", error);
    return false;
  }
}

/**
 * Clear cart
 */
export function clearCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
  window.dispatchEvent(new Event("cartUpdated"));
}

/**
 * Get cart total
 */
export function getCartTotal(): number {
  const cart = getCartItems();
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

/**
 * Get cart item count
 */
export function getCartItemCount(): number {
  const cart = getCartItems();
  return cart.reduce((count, item) => count + item.quantity, 0);
}

// ==================== RECENTLY VIEWED ====================

export interface RecentlyViewedProduct {
  productId: string;
  productSlug: string;
  productName: string;
  brandName: string;
  price: number;
  currency: string;
  imageUrl: string;
  viewedAt: number; // timestamp
}

/**
 * Add product to recently viewed
 */
export function addToRecentlyViewed(product: RecentlyViewedProduct): void {
  if (typeof window === "undefined") return;

  try {
    const recentlyViewed = getRecentlyViewed();

    // Remove if already exists (to update timestamp)
    const filtered = recentlyViewed.filter(
      (p) => p.productId !== product.productId
    );

    // Add to beginning
    filtered.unshift({
      ...product,
      viewedAt: Date.now(),
    });

    // Keep only last 10 items
    const limited = filtered.slice(0, 10);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error("Error adding to recently viewed:", error);
  }
}

/**
 * Get recently viewed products
 */
export function getRecentlyViewed(): RecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading recently viewed:", error);
    return [];
  }
}
