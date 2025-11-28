import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Play, Star } from 'lucide-react';

/**
 * Glass Theme Demo Component
 * Showcases all the new iOS glassmorphism components
 * 
 * Usage: Import this component and add it to a route to see all glass effects
 */

const GlassThemeDemo = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-8">
            <div className="max-w-7xl mx-auto space-y-12">

                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-gradient text-6xl font-bold">
                        iOS Glassmorphism Theme
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Beautiful frosted glass effects for your app
                    </p>
                    <div className="highlight-bar mx-auto"></div>
                </div>

                {/* Glass Cards Section */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Glass Cards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Basic Glass Card */}
                        <div className="glass-card p-6 space-y-4">
                            <h3 className="text-xl font-semibold">Basic Glass Card</h3>
                            <p className="text-muted-foreground">
                                Standard glass effect with subtle transparency and blur
                            </p>
                            <div className="flex gap-2">
                                <span className="glass-badge">React</span>
                                <span className="glass-badge">TypeScript</span>
                            </div>
                        </div>

                        {/* Glass Card with Hover */}
                        <div className="glass-card-hover p-6 space-y-4 cursor-pointer">
                            <h3 className="text-xl font-semibold">Hover Glass Card</h3>
                            <p className="text-muted-foreground">
                                Hover over me to see the lift effect!
                            </p>
                            <div className="flex gap-2">
                                <Heart className="h-5 w-5 text-primary" />
                                <MessageCircle className="h-5 w-5 text-primary" />
                                <Share2 className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        {/* Glass Card with Shine */}
                        <div className="glass-card glass-shine p-6 space-y-4">
                            <h3 className="text-xl font-semibold">Shine Glass Card</h3>
                            <p className="text-muted-foreground">
                                Animated shine effect for premium feel
                            </p>
                            <div className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                                <span className="text-sm">Premium</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Buttons Section */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Glass Buttons</h2>
                    <div className="flex flex-wrap gap-4">
                        <button className="glass-button">
                            Glass Button
                        </button>
                        <button className="glass-button-primary">
                            Primary Button
                        </button>
                        <button className="glass-button hover-scale">
                            Hover Scale
                        </button>
                        <button className="glass-button-primary click-effect">
                            Click Effect
                        </button>
                    </div>
                </section>

                {/* Input Fields Section */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Glass Inputs</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                        <input
                            className="glass-input"
                            placeholder="Enter your name..."
                        />
                        <input
                            className="glass-input"
                            placeholder="Enter your email..."
                            type="email"
                        />
                        <textarea
                            className="glass-input md:col-span-2"
                            placeholder="Write a message..."
                            rows={4}
                        />
                    </div>
                </section>

                {/* Post Card Example */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Example: Glass Post Card</h2>
                    <div className="glass-card-hover p-6 space-y-4 max-w-2xl">
                        {/* Post Header */}
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                                JD
                            </div>
                            <div>
                                <h4 className="font-semibold">John Doe</h4>
                                <p className="text-sm text-muted-foreground">2 hours ago</p>
                            </div>
                        </div>

                        {/* Post Content */}
                        <p className="text-foreground">
                            Just implemented the new iOS glassmorphism theme! 🎨
                            The frosted glass effects look absolutely stunning!
                            #WebDesign #iOS #Glassmorphism
                        </p>

                        {/* Post Image Placeholder */}
                        <div className="glass-card-dark rounded-2xl h-48 flex items-center justify-center">
                            <Play className="h-12 w-12 text-primary" />
                        </div>

                        {/* Post Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <button className="glass-button flex items-center gap-2">
                                <Heart className="h-4 w-4" />
                                <span>124</span>
                            </button>
                            <button className="glass-button flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                <span>32</span>
                            </button>
                            <button className="glass-button flex items-center gap-2">
                                <Share2 className="h-4 w-4" />
                                <span>Share</span>
                            </button>
                            <button className="glass-button">
                                <Bookmark className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Badges Section */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Glass Badges</h2>
                    <div className="flex flex-wrap gap-3">
                        <span className="glass-badge">Design</span>
                        <span className="glass-badge">Development</span>
                        <span className="glass-badge">React</span>
                        <span className="glass-badge">TypeScript</span>
                        <span className="glass-badge">Supabase</span>
                        <span className="glass-badge">Glassmorphism</span>
                    </div>
                </section>

                {/* Navigation Example */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Glass Navigation</h2>
                    <div className="glass-navbar p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-gradient text-xl font-bold">ReelSphere</h3>
                            <div className="flex gap-2">
                                <div className="nav-item nav-item-active">
                                    <span>Home</span>
                                </div>
                                <div className="nav-item nav-item-inactive">
                                    <span>Projects</span>
                                </div>
                                <div className="nav-item nav-item-inactive">
                                    <span>Network</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Gradient Effects */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Gradient Effects</h2>
                    <div className="space-y-4">
                        <h3 className="text-gradient text-4xl font-bold">
                            Beautiful Gradient Text
                        </h3>
                        <div className="glass-card gradient-border p-6">
                            <p>Card with animated gradient border</p>
                        </div>
                    </div>
                </section>

                {/* Animation Examples */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-bold">Animations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card hover-lift p-6 cursor-pointer">
                            <h4 className="font-semibold mb-2">Hover Lift</h4>
                            <p className="text-sm text-muted-foreground">Hover to lift up</p>
                        </div>
                        <div className="glass-card hover-scale p-6 cursor-pointer">
                            <h4 className="font-semibold mb-2">Hover Scale</h4>
                            <p className="text-sm text-muted-foreground">Hover to scale</p>
                        </div>
                        <button className="glass-button-primary click-effect w-full h-full">
                            <div>
                                <h4 className="font-semibold mb-2">Click Effect</h4>
                                <p className="text-sm">Click to see effect</p>
                            </div>
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default GlassThemeDemo;
