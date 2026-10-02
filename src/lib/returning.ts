export const EDITOR_COOKIE = "skeu-editor";
// The home page, even for someone the proxy would send to the editor.
export const HOME_HREF = "/?home";

export function rememberEditor() {
  document.cookie = `${EDITOR_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}
