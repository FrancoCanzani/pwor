import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteNote } from "./delete";
import { registerGetNote } from "./get";
import { registerGetAllNotes } from "./get-all";
import { registerGetNoteImage } from "./get-image";
import { registerPostNote } from "./post";
import { registerPostNoteImage } from "./post-image";
import { registerPutNote } from "./put";

const notes = new Hono<AppEnv>();

registerGetAllNotes(notes);
registerPostNote(notes);
registerGetNoteImage(notes);
registerPostNoteImage(notes);
registerGetNote(notes);
registerPutNote(notes);
registerDeleteNote(notes);

export { notes };
