/**
 * Fluent UI Icon Component
 * Uses SVG paths for Fluent UI icons
 */
import React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";

type FluentIconName =
  | "Search24Regular"
  | "Dismiss24Regular"
  | "Edit24Regular"
  | "Delete24Regular"
  | "Copy24Regular"
  | "ChevronRight24Regular"
  | "Bookmark24Regular"
  | "Bookmark24Filled"
  | "Document24Regular";

type FluentIconProps = {
  name: FluentIconName;
  size?: number;
  color?: string;
};

// Fluent UI icon paths (24x24 regular style)
const iconPaths: Record<FluentIconName, string> = {
  Search24Regular:
    "M10 2.75a7.25 7.25 0 1 0 0 14.5 7.25 7.25 0 0 0 0-14.5ZM1.25 10a8.75 8.75 0 1 1 15.388 5.75l4.556 4.557a.75.75 0 0 1-.976 1.133l-.084-.073-4.557-4.556A8.75 8.75 0 0 1 1.25 10Z",
  Dismiss24Regular:
    "M5.72 5.72a.75.75 0 0 1 1.06 0L12 10.44l5.22-5.22a.75.75 0 1 1 1.06 1.06L13.06 11.5l5.22 5.22a.75.75 0 0 1-1.06 1.06L12 12.56l-5.22 5.22a.75.75 0 0 1-1.06-1.06l5.22-5.22-5.22-5.22a.75.75 0 0 1 0-1.06Z",
  Edit24Regular:
    "M21.03 2.97a3.578 3.578 0 0 1 0 5.06L9.06 20c-.27.27-.618.47-1 .56l-5.1 1.4a.75.75 0 0 1-.92-.93l1.4-5.1c.09-.38.29-.73.56-1L15.97 2.97a3.578 3.578 0 0 1 5.06 0ZM20.47 3.53a2.078 2.078 0 0 0-2.94 0L4.5 16.56l-1.04 3.8 3.8-1.04L20.47 5.47a2.078 2.078 0 0 0 0-2.94Z",
  Delete24Regular:
    "M14.5 2a2 2 0 0 1 2 2v1h3.5a.75.75 0 0 1 0 1.5H19v11.25a3.25 3.25 0 0 1-3.25 3.25h-7.5A3.25 3.25 0 0 1 5.5 17.75V6.5H4a.75.75 0 0 1 0-1.5h3.5V4a2 2 0 0 1 2-2h5Zm3 4H6.5v11.25c0 .97.78 1.75 1.75 1.75h7.5c.97 0 1.75-.78 1.75-1.75V6Zm-5.25 3.25a.75.75 0 0 0-.75.75v6.5a.75.75 0 0 0 1.5 0v-6.5a.75.75 0 0 0-.75-.75Zm-3.5.75a.75.75 0 0 0-1.5 0v6.5a.75.75 0 0 0 1.5 0v-6.5ZM14 4H10v-.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4Z",
  Copy24Regular:
    "M6.5 2A2.5 2.5 0 0 0 4 4.5v13A2.5 2.5 0 0 0 6.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 15.5 6H13V4.5A2.5 2.5 0 0 0 10.5 2h-4ZM13 7.5V4.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7.5h-2.5A2.5 2.5 0 0 1 13 7.5Zm1.5 0h2.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H14.5Z",
  ChevronRight24Regular:
    "M8.7 4.46a.75.75 0 0 1 1.06 0l6.5 6.5a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 1 1-1.06-1.06L14.69 12 8.7 5.52a.75.75 0 0 1 0-1.06Z",
  Bookmark24Regular:
    "M6.19 3.75A2.25 2.25 0 0 1 8.44 2.5h7.12a2.25 2.25 0 0 1 2.25 2.25v15.5a.75.75 0 0 1-1.2.6L12 17.5l-4.61 3.35a.75.75 0 0 1-1.2-.6V3.75ZM8.44 4a.75.75 0 0 0-.75.75v14.2l3.86-2.8a.75.75 0 0 1 .9 0l3.86 2.8V4.75a.75.75 0 0 0-.75-.75H8.44Z",
  Bookmark24Filled:
    "M6.19 3.75A2.25 2.25 0 0 1 8.44 2.5h7.12a2.25 2.25 0 0 1 2.25 2.25v15.5a.75.75 0 0 1-1.2.6L12 17.5l-4.61 3.35a.75.75 0 0 1-1.2-.6V3.75Z",
  Document24Regular:
    "M5.5 2A2.5 2.5 0 0 0 3 4.5v15A2.5 2.5 0 0 0 5.5 22h13a2.5 2.5 0 0 0 2.5-2.5v-11h-5.5A2.5 2.5 0 0 1 15 6V2H5.5ZM19 7.5V19.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H14.5v3.5a2.5 2.5 0 0 0 2.5 2.5H19Z",
};

export function FluentIcon({
  name,
  size = 24,
  color = "#000000",
}: FluentIconProps) {
  const path = iconPaths[name];
  if (!path) {
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={path} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}
