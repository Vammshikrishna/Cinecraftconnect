/**
 * The 24 crafts shown on the landing page, each with a one-colour line glyph drawn on a 24 x 24 grid.
 * Both apps draw the same glyph (web with <svg>, the phone app with react-native-svg) and stack copies of it to give it depth.
 * The names are roles from the profile role list, so each one is something a person can really pick on their profile.
 */
export interface CraftGlyph {
  /** short name shown under the 3D tile */
  name: string;
  /** SVG path data on a 24 x 24 grid, meant to be stroked (round caps and joins), not filled */
  d: string;
}

const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const CRAFT_GLYPHS: CraftGlyph[] = [
  { name: 'Director', d: 'M3 10v4h3l8 4V6L6 10H3zM17.5 9.5a4 4 0 0 1 0 5M20 7a8 8 0 0 1 0 10' },
  { name: 'Producer', d: 'M4 11h16v9H4zM3.5 7.2 18.9 3.5l.9 3.6L4.4 10.8zM8.5 6.2l2 3.2M13 5.1l2 3.2' },
  { name: 'Screenwriter', d: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 15.5h6M9 9h2' },
  { name: 'Cinematographer', d: 'M3 7h12v10H3zM15 11l6-3.5v9L15 13z' },
  { name: '1st AC', d: `${circle(12, 12, 9)}${circle(12, 12, 3.5)}M15.5 12H21M13.75 15.03l2.75 4.76M10.25 15.03l-2.75 4.76M8.5 12H3M10.25 8.97 7.5 4.21M13.75 8.97l2.75-4.76` },
  { name: 'Gaffer', d: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.2 1.1 2.2h5c0-1 .4-1.7 1.1-2.2A6 6 0 0 0 12 3z' },
  { name: 'Grip', d: `${circle(12, 12, 9)}${circle(12, 12, 2.2)}M12 3v6.8M12 14.2V21M3 12h6.8M14.2 12H21` },
  { name: 'Production Designer', d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5' },
  { name: 'Costume Designer', d: 'M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z' },
  { name: 'Makeup Artist', d: 'M8 21v-7h8v7zM9.5 14V9.2L12 3.5l2.5 5.7V14' },
  { name: 'Actor', d: `${circle(12, 12, 9)}M9 10h.01M15 10h.01M8 14.5a5 5 0 0 0 8 0` },
  { name: 'Casting Director', d: `${circle(9, 8, 3.2)}M3 20a6 6 0 0 1 12 0${circle(17, 9, 2.6)}M16.5 14.4A5 5 0 0 1 21 19` },
  { name: 'Choreographer', d: `${circle(13, 4.5, 2)}M13 7.5l-1 6.5 4 3.5-.8 4M12 14l-4 2.5-1 4M6 9.5l6.5-1.5 5.5 3.5` },
  { name: 'Stunt Coordinator', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  { name: 'Editor', d: `${circle(6, 6, 3)}${circle(6, 18, 3)}M8.1 8.1 12 12M20 4 8.1 15.9M14.8 14.8 20 20` },
  { name: 'Colorist', d: 'M12 3s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3zM9 15a3 3 0 0 0 3 3' },
  { name: 'VFX Artist', d: 'M10 3l1.9 5.6 5.6 1.9-5.6 1.9L10 18l-1.9-5.6-5.6-1.9 5.6-1.9zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z' },
  { name: 'Sound Designer', d: 'M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4' },
  { name: 'Sound Mixer', d: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6' },
  { name: 'Composer', d: `M9 18V5l12-2v13${circle(6, 18, 3)}${circle(18, 16, 3)}` },
  { name: 'Script Supervisor', d: 'M9 3h6v3H9zM8 4.5H5v17h14v-17h-3M8.5 14l2.5 2.5 4.5-5' },
  { name: 'Location Manager', d: `M12 21.5s7-6.1 7-12.2a7 7 0 0 0-14 0c0 6.1 7 12.2 7 12.2z${circle(12, 9.3, 2.6)}` },
  { name: 'Storyboard Artist', d: 'M3 4.5h8v6H3zM13 4.5h8v6h-8zM3 13.5h8v6H3zM13 13.5h8v6h-8z' },
  { name: '1st AD', d: `${circle(12, 13.5, 7.5)}M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6M19 6l1.5-1.5` },
];
