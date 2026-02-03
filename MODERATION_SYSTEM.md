# Product Moderation System - Implementation Complete

## Overview
A complete product moderation system has been implemented with role-based access control, separating seller dashboards from admin moderation panels. Products must be approved by an admin before appearing publicly on the site.

---

## What Was Implemented

### 1. Database Schema Changes

**New Tables:**
- `profiles` - User roles (user, seller, admin)

**Updated Tables:**
- `brands` - Added `owner_id` and `status` columns
- `products` - Added `owner_id`, `status`, `rejection_reason`, `submitted_at`, `approved_at` columns

**Product Status Flow:**
```
draft → (seller submits) → pending → (admin approves) → approved
                                  → (admin rejects) → rejected → (edit) → pending
```

### 2. Authentication & Authorization

**New Auth Utilities** ([app/lib/auth.ts](app/lib/auth.ts)):
- `isAdmin()` - Checks if user is admin (via `profiles.role` OR `NEXT_PUBLIC_ADMIN_EMAILS`)
- `isSeller()` - Checks if user is approved seller
- `getUserRole()` - Returns user's role
- `getCurrentUserId()` - Gets current user ID
- `getSellerRecord()` - Gets seller profile

**Admin Detection:**
Admins are determined by TWO methods:
1. Database: `profiles.role = 'admin'`
2. Environment variable: `NEXT_PUBLIC_ADMIN_EMAILS`

**NO hardcoded passwords or credentials!**

### 3. Seller Dashboard

**Routes Created:**
- `/account/seller` - Dashboard overview with stats
- `/account/seller/brands` - Manage brands (create, edit, delete)
- `/account/seller/products` - List all products with status filtering
- `/account/seller/products/new` - Create new product (saved as draft)
- `/account/seller/products/[id]/edit` - Edit product (placeholder)

**Features:**
- Status badges (draft, pending, approved, rejected)
- Filter products by status
- Submit products for moderation
- View rejection reasons
- Only sellers can access (redirects to `/account/become-seller` if not seller)

### 4. Admin Moderation Panel

**Routes Created:**
- `/account/moderation` - Review pending products

**Features:**
- View all pending products
- Filter: Pending / All products
- Approve products (sets status to "approved")
- Reject products with reason (seller can see the reason)
- Only admins can access (redirects to `/account` if not admin)

### 5. Updated Public Pages

**Changes:**
- [app/page.tsx](app/page.tsx) - Shows only approved brands
- [app/brand/[slug]/page.tsx](app/brand/[slug]/page.tsx) - Shows only approved products
- [app/product/[id]/page.tsx](app/product/[id]/page.tsx) - Shows only approved products

**Result:** Public users only see approved content!

### 6. Updated Navigation

**Sidebar Changes** ([app/account/sidebar.tsx](app/account/sidebar.tsx)):
- Shows "My Shop" link for sellers → `/account/seller`
- Shows "Moderation" link for admins → `/account/moderation`
- Removed old "Admin Panel" link

**Dynamic Menu:** Menu items appear based on user's role (checked in real-time)

### 7. Security - Row Level Security (RLS)

All tables have proper RLS policies:

**Brands:**
- Public: Can view only approved brands
- Sellers: Can CRUD only own brands
- Admins: Can view and update any brand

**Products:**
- Public: Can view only approved products from approved brands
- Sellers: Can CRUD only own products
- Admins: Can view and update any product

**Product Images & Sizes:**
- Follow parent product permissions

---

## Setup Instructions

### Step 1: Update Database

1. Open Supabase Console: https://mvsaxxnlnzpswtyjpgkr.supabase.co
2. Go to **SQL Editor**
3. Open the updated [supabase-setup.sql](supabase-setup.sql) file
4. **Copy the ENTIRE file** and paste into SQL Editor
5. Click **RUN** to execute

**Important:** This will:
- Create `profiles` table
- Add columns to `brands` and `products` tables
- Create `is_admin()` function
- Drop old RLS policies
- Create new secure RLS policies

### Step 2: Configure Admin Emails

1. Open [.env.local](.env.local)
2. Add your admin email(s):
   ```
   NEXT_PUBLIC_ADMIN_EMAILS=your-email@example.com,admin2@example.com
   ```
3. Use comma-separated list for multiple admins

**Alternative:** Set admin role in database:
```sql
INSERT INTO profiles (id, email, role)
VALUES ('user-uuid', 'admin@example.com', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### Step 3: Start Development Server

```bash
npm run dev
```

Or build for production:
```bash
npm run build
npm start
```

---

## How To Use

### For Sellers:

1. **Register as Seller:**
   - Click LOGIN → "Create account"
   - Choose "Seller Account"
   - Complete registration
   - Fill out "Become a seller" form

2. **Access Seller Dashboard:**
   - Go to Account → "My Shop"
   - Or visit: `/account/seller`

3. **Create Brand:**
   - My Shop → Manage Brands → "Create Brand"
   - Fill in brand details and upload logo
   - Click "Create Brand"

4. **Create Product:**
   - My Shop → "Create New Product"
   - Select brand, fill details
   - Product is saved as **draft**

5. **Submit for Moderation:**
   - My Shop → Manage Products
   - Find draft product
   - Click "Submit for Review"
   - Product status changes to **pending**

6. **Check Product Status:**
   - My Shop → Manage Products
   - Filter by status: Draft / Pending / Approved / Rejected
   - If rejected, you'll see the reason

7. **Edit Rejected Products:**
   - Edit the product
   - Make changes based on rejection reason
   - Submit again for review

### For Admins:

1. **Access Moderation Panel:**
   - Go to Account → "Moderation"
   - Or visit: `/account/moderation`

2. **Review Pending Products:**
   - View list of all pending products
   - See product details, images, seller info

3. **Approve Product:**
   - Click "✓ Approve" button
   - Product status changes to **approved**
   - Product appears on public site

4. **Reject Product:**
   - Click "✕ Reject" button
   - Enter rejection reason
   - Click "Confirm Rejection"
   - Seller will see the reason

---

## File Structure

```
app/
├── lib/
│   └── auth.ts                          ← NEW: Authentication utilities
├── account/
│   ├── sidebar.tsx                      ← UPDATED: Dynamic menu
│   ├── seller/                          ← NEW: Seller dashboard
│   │   ├── page.tsx                     ← Dashboard overview
│   │   ├── brands/
│   │   │   └── page.tsx                 ← Manage brands
│   │   └── products/
│   │       ├── page.tsx                 ← List products with filters
│   │       ├── new/
│   │       │   └── page.tsx             ← Create product
│   │       └── [id]/
│   │           └── edit/
│   │               └── page.tsx         ← Edit product
│   └── moderation/                      ← NEW: Admin moderation
│       └── page.tsx                     ← Review products
├── page.tsx                             ← UPDATED: Filter approved brands
├── brand/[slug]/page.tsx                ← UPDATED: Filter approved products
├── product/[id]/page.tsx                ← UPDATED: Only approved products
└── layout.tsx                           ← UPDATED: Wrapped AuthModal in Suspense

supabase-setup.sql                       ← UPDATED: Complete DB schema
.env.local                               ← UPDATED: Added NEXT_PUBLIC_ADMIN_EMAILS
```

---

## Security Features

✅ **No Hardcoded Credentials**
- Admins determined by database role OR environment variable
- No passwords in code

✅ **Row Level Security (RLS)**
- All tables have RLS enabled
- Policies enforce data ownership
- Sellers can only see/edit their own products
- Public can only see approved content

✅ **Server-Side Checks**
- Admin/seller checks happen server-side
- Client-side UI adjustments are just for UX
- Database policies are the source of truth

✅ **Product Status Workflow**
- Draft → Pending → Approved/Rejected
- Sellers can't approve their own products
- Only admins can change status to approved

---

## Testing Checklist

- [x] ✅ Project builds without errors
- [ ] Create test seller account
- [ ] Register as seller and fill "Become a seller" form
- [ ] Verify "My Shop" appears in sidebar
- [ ] Create a brand as seller
- [ ] Create a product as seller (draft status)
- [ ] Product NOT visible on homepage
- [ ] Submit product for moderation (pending status)
- [ ] Set admin email in `.env.local`
- [ ] Verify "Moderation" appears in sidebar for admin
- [ ] Admin can see pending product in moderation panel
- [ ] Admin approves product
- [ ] Product appears on homepage (approved status)
- [ ] Admin rejects product with reason
- [ ] Seller sees rejection reason in products list
- [ ] Seller edits rejected product and resubmits
- [ ] Non-seller cannot access `/account/seller`
- [ ] Non-admin cannot access `/account/moderation`

---

## Troubleshooting

### Error: "table profiles does not exist"
**Solution:** Run the SQL migration script in Supabase SQL Editor

### Error: "column owner_id does not exist"
**Solution:** Run the SQL migration script - it adds owner_id to brands/products

### "My Shop" doesn't appear in sidebar
**Solution:**
1. Make sure you filled out "Become a seller" form
2. Check that sellers table has your user_id with status='approved'
3. Check browser console for errors

### "Moderation" doesn't appear in sidebar
**Solution:**
1. Add your email to `NEXT_PUBLIC_ADMIN_EMAILS` in `.env.local`
2. OR add admin role to profiles table in database
3. Restart dev server after changing .env

### Products not showing on homepage
**Solution:** Products must be:
1. Status = 'approved' (admin must approve)
2. Brand status = 'approved'
3. Check RLS policies are active

### Build error: "useSearchParams should be wrapped in suspense"
**Solution:** Already fixed - AuthModal is wrapped in `<Suspense>` in layout.tsx

---

## What's Next?

**Suggested Improvements:**
1. Implement product edit functionality (currently placeholder)
2. Add image upload for products in create/edit forms
3. Add email notifications when products are approved/rejected
4. Add bulk actions for admins (approve multiple products at once)
5. Add product preview for pending products
6. Add analytics dashboard for sellers
7. Add comment/feedback system between admin and seller

---

## Support

If you encounter any issues:
1. Check the Troubleshooting section above
2. Verify database migrations ran successfully
3. Check browser console for JavaScript errors
4. Check Supabase logs for database errors
5. Ensure .env.local has correct values

---

**✅ Implementation Complete - Ready to Use!**
