import { FC, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from "@/integrations/supabase/client";
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// More lenient URL validation - only check basic format
const optionalUrl = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    // Trim whitespace
    const trimmed = String(val).trim();
    if (trimmed === "") return undefined;
    return trimmed;
  },
  z.string().refine(
    (val) => {
      if (!val) return true; // Optional field
      // Basic URL check - must start with http:// or https:// or be a valid domain
      return /^(https?:\/\/)/.test(val) || /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}/.test(val);
    },
    { message: "Please enter a valid URL" }
  ).optional()
);

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name is too short").max(50, "Name is too long").optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be 20 characters or less"),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  craft: z.string().max(1000, "Craft must be 1000 characters or less").optional(),
  location: z.string().max(100, "Location must be 100 characters or less").optional(),
  website: optionalUrl,
  youtube_url: optionalUrl,
  social_links: z.object({
    instagram: optionalUrl,
    linkedin: optionalUrl,
    twitter: optionalUrl,
    facebook: optionalUrl,
  }).optional(),
});

interface EditProfileFormProps {
  profile: Profile;
  onUpdate: (updatedProfile: Profile) => void;
  setEditing: (isEditing: boolean) => void;
}

const EditProfileForm: FC<EditProfileFormProps> = ({ profile, onUpdate, setEditing }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    mode: "onBlur", // Only validate when user leaves the field, not on every keystroke
    defaultValues: {
      full_name: profile.full_name || "",
      username: profile.username || "",
      bio: profile.bio || "",
      craft: profile.craft || "",
      location: profile.location || "",
      website: profile.website || "",
      youtube_url: profile.youtube_url || "",
      social_links: {
        instagram: profile.social_links?.instagram || "",
        linkedin: profile.social_links?.linkedin || "",
        twitter: profile.social_links?.twitter || "",
        facebook: profile.social_links?.facebook || "",
      },
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    if (!user) return;

    // Show loading toast
    const loadingToast = toast({
      title: "Saving profile...",
      description: "Please wait while we update your profile.",
      duration: 10000
    });

    try {
      let avatar_url = profile.avatar_url;

      if (avatarFile) {
        const { compressImage } = await import('@/utils/imageCompression');
        const compressedAvatar = await compressImage(avatarFile, 400, 400, 0.8); // avatar can be smaller (400x400)
        const fileExt = compressedAvatar.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, compressedAvatar, {
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          loadingToast.dismiss();
          toast({ title: "Avatar Upload Failed", description: uploadError.message, variant: "destructive" });
          return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatar_url = urlData.publicUrl;
      }

      let cover_image_url = profile.cover_image_url;
      if (coverFile) {
        const { compressImage } = await import('@/utils/imageCompression');
        const compressedCover = await compressImage(coverFile, 1200, 400, 0.75); // cover can be wider but lower height/quality
        const fileExt = compressedCover.name.split('.').pop();
        const fileName = `cover-${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars') // Using avatars bucket for both for now, or consider a 'covers' bucket
          .upload(fileName, compressedCover, {
            cacheControl: '31536000',
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          cover_image_url = urlData.publicUrl;
        }
      }

      // Optimized: No need to select() after update, we already have the data
      const updatedData = {
        ...profile,
        ...values,
        avatar_url,
        cover_image_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          ...values,
          avatar_url,
          cover_image_url,
          updated_at: updatedData.updated_at,
        })
        .eq('id', user.id);

      loadingToast.dismiss();

      if (error) {
        toast({
          title: "Error updating profile",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Profile updated successfully!", duration: 3000 });
        onUpdate(updatedData as Profile);
        setEditing(false);
      }
    } catch (error: any) {
      loadingToast.dismiss();
      toast({
        title: "Unexpected error",
        description: error?.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <div className="space-y-6 mb-8">
        <div className="relative group w-full h-40 rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {coverPreview ? (
            <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 italic">No banner set</div>
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
            <span className="font-semibold px-4 py-2 bg-black/60 rounded-lg">Change Banner</span>
            <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col items-center gap-4 -mt-20 relative z-10">
          <Avatar className="w-36 h-36 border-4 border-gray-800 shadow-xl">
            <AvatarImage src={avatarPreview || ''} alt="Avatar Preview" />
            <AvatarFallback className="bg-gray-700 text-5xl">
              {profile.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
            <FormLabel htmlFor="avatar-upload" className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold text-sm">Change Photo</FormLabel>
            <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Your full name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Your username" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="Tell us a little about yourself" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="craft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Craft</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="Share your relevant craft" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="City, Country" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://your-website.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-800">
          <h3 className="text-lg font-semibold">Social Media</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="social_links.instagram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Instagram profile URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="social_links.linkedin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="LinkedIn profile URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="social_links.twitter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twitter / X</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Twitter profile URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="social_links.facebook"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Facebook profile URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="youtube_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="YouTube channel URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-6 border-t border-gray-800">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default EditProfileForm;
