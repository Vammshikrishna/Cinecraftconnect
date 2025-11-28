# Premium Card Enhancement Guide

## 🎨 Make Your Cards Look Rich & Premium

Quick guide to enhance existing cards with premium glass effects!

---

## 📝 **Simple Replacements**

### 1. **PostCard.tsx** - Line 120

**Find:**
```tsx
<div className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,135,245,0.3)]">
```

**Replace with:**
```tsx
<div className="group relative">
  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-accent to-secondary rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500"></div>
  <div className="relative glass-card-hover rounded-2xl p-6 space-y-4">
```

**And at the end, close with:**
```tsx
  </div>
</div>
```

---

### 2. **Avatar Enhancement** - Line 122-125

**Find:**
```tsx
<Avatar className="h-10 w-10 mr-3">
  <AvatarImage src={author.avatar || "/placeholder.svg"} />
  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">{author.initials}</AvatarFallback>
</Avatar>
```

**Replace with:**
```tsx
<div className="relative">
  <Avatar className="h-12 w-12 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
    <AvatarImage src={author.avatar || "/placeholder.svg"} />
    <AvatarFallback className="bg-gradient-to-br from-primary via-accent to-secondary text-white font-semibold">
      {author.initials}
    </AvatarFallback>
  </Avatar>
  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
</div>
```

---

### 3. **Action Buttons** - Around Line 180

**Find:**
```tsx
<Button variant="ghost" size="sm" ...>
  <Heart ... />
  <span>{likeCount}</span>
</Button>
```

**Replace with:**
```tsx
<button
  onClick={handleLike}
  disabled={isLiking}
  className={`glass-button flex items-center gap-2 px-4 py-2 transition-all duration-300 ${
    isLiked
      ? 'bg-red-500/20 border-red-500/40 text-red-500'
      : 'hover:bg-primary/10 hover:border-primary/30'
  }`}
>
  <Heart className={`h-4 w-4 transition-all duration-300 ${isLiked ? 'fill-red-500 scale-110' : ''}`} />
  <span className="font-medium">{likeCount}</span>
</button>
```

---

### 4. **Tags Enhancement**

**Find:**
```tsx
<span className="text-xs px-2 py-1 bg-muted/20 rounded-full ...">
  #{tag}
</span>
```

**Replace with:**
```tsx
<span className="glass-badge text-xs px-3 py-1 hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer">
  #{tag}
</span>
```

---

### 5. **Image/Media Enhancement**

**Find:**
```tsx
<div className="mb-4 rounded-lg overflow-hidden bg-card/50 relative">
  {mediaUrl ? (
    <img src={mediaUrl} ... />
  ) : ...}
</div>
```

**Replace with:**
```tsx
<div className="relative rounded-xl overflow-hidden group/media">
  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 z-10"></div>
  {mediaUrl ? (
    <img
      src={mediaUrl}
      alt={imageAlt || "Post image"}
      className="w-full h-auto object-cover max-h-[500px] transition-transform duration-500 group-hover/media:scale-105"
    />
  ) : ...}
</div>
```

---

## 🎯 **Quick CSS Additions**

Add these to your component if needed:

```css
/* Gradient glow on hover */
.group:hover .gradient-glow {
  opacity: 0.2;
}

/* Smooth image zoom */
.group/media:hover img {
  transform: scale(1.05);
}
```

---

## ✨ **Result**

Your cards will have:
- ✅ Gradient glow on hover
- ✅ Larger, ringed avatars with online indicator
- ✅ Premium glass buttons
- ✅ Smooth image zoom effects
- ✅ Better spacing and typography
- ✅ Rich visual depth

---

## 🚀 **Apply to Other Cards**

Use the same pattern for:
- Project cards
- Discussion room cards
- User profile cards
- Any other card components

**Pattern:**
```tsx
<div className="group relative">
  {/* Gradient glow */}
  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-accent to-secondary rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500"></div>
  
  {/* Main content */}
  <div className="relative glass-card-hover rounded-2xl p-6">
    {/* Your content here */}
  </div>
</div>
```

---

**Your cards will look premium and rich!** ✨
