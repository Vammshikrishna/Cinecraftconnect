{pkgs}: {
  channel = "stable-24.05";
  packages = [ pkgs.nodejs_20 pkgs.docker pkgs.supabase-cli pkgs.rootlesskit pkgs.deno ];
  idx.extensions = [ "svelte.svelte-vscode" "vue.volar" "denoland.vscode-deno" ];
  idx.previews = {
    previews = {
      web = {
        command = [ "npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0" ];
        manager = "web";
      };
    };
  };
  services.docker.enable = true;
}