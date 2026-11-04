"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/clientErrorReporter";

/** Sends this browser's crashes to the three-day error log; renders nothing. */
export default function ErrorReporter() {
  useEffect(() => installClientErrorReporter(), []);
  return null;
}
