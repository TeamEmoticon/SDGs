import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import type { Signal } from "@/lib/types";

/**
 * Persists every analysis run so the tool can show recent checks and keep a
 * lightweight audit trail. Sensitive details are stored already-masked.
 */
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  inputType: text("input_type").notNull(), // "text" | "url"
  sourceUrl: text("source_url"),
  maskedText: text("masked_text").notNull(),
  riskLevel: text("risk_level").notNull(), // safe | caution | danger | critical
  riskScore: integer("risk_score").notNull(),
  infoType: text("info_type"),
  summary: text("summary"),
  riskPhrases: jsonb("risk_phrases").$type<string[]>(),
  signals: jsonb("signals").$type<Signal[]>(),
  groqUsed: boolean("groq_used").default(false).notNull(),
});

export type AnalysisRow = typeof analyses.$inferSelect;
