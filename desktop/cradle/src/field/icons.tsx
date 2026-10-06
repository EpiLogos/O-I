/** The field's icon symbols (the site's own set), prefixed so they never collide with another sprite in the app. */
export function FieldIcons() {
  return (
    <svg width="0" height="0" style={{position: "absolute"}} aria-hidden="true" focusable="false">
      <symbol id="fi-essay" viewBox="0 0 20 20"><path d="M5 3.5h10v13H5z M7.5 7h5 M7.5 10h5 M7.5 13h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="fi-split" viewBox="0 0 20 20"><path d="M3 4.5h14v11H3z M10 4.5v11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></symbol>
      <symbol id="fi-field" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="5" cy="14" r="1.8"/><circle cx="10.5" cy="5.5" r="1.8"/><circle cx="15.5" cy="13" r="1.8"/><path d="M6.4 12.7 9.2 7M12 6.7l2.6 4.7M6.8 14.2h6.9"/></g></symbol>
      <symbol id="fi-search" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8.8" cy="8.8" r="5"/><path d="m12.6 12.6 4 4"/></g></symbol>
      <symbol id="fi-tree" viewBox="0 0 20 20"><path d="M4 4.5h5M7 9h9M7 13.5h9M4 4.5v9M4 9h3M4 13.5h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></symbol>
      <symbol id="fi-x" viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
      <symbol id="fi-chev" viewBox="0 0 20 20"><path d="m7 4.5 5.5 5.5L7 15.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="fi-sliders" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3.5 6h6M13.5 6h3M3.5 14h2M9.5 14h7"/><circle cx="11.5" cy="6" r="1.8"/><circle cx="7.5" cy="14" r="1.8"/></g></symbol>
      <symbol id="fi-fit" viewBox="0 0 20 20"><path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="fi-expression" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M10 2.8 17 7v6L10 17.2 3 13V7z"/><path d="M3.3 7.2 10 11l6.7-3.8M10 11v6" strokeLinecap="round"/></g></symbol>
      <symbol id="fi-library" viewBox="0 0 20 20"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><rect x="3" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="3" y="11" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="11" width="5.5" height="5.5" rx="1"/></g></symbol>
      <symbol id="fi-external" viewBox="0 0 20 20"><path d="M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></symbol>
    </svg>
  );
}

export function Icon({name, size = 16, style}: {name: string; size?: number; style?: React.CSSProperties}) {
  return <svg width={size} height={size} style={style} aria-hidden="true"><use href={`#fi-${name}`}/></svg>;
}
