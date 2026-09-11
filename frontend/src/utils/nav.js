/**
 * Go back if there is somewhere to go back to inside the app; otherwise
 * (e.g. the app was opened from a home-screen shortcut) go to `fallback`.
 */
export function goBack(navigate, fallback = '/') {
  if (window.history.state?.idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
