import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(), state: text("state").notNull(), revision: integer("revision").notNull().default(0),
  pulseHash: text("pulse_hash").notNull(), echoHash: text("echo_hash"), pulseName: text("pulse_name").notNull(), echoName: text("echo_name"),
  pulseSeen: integer("pulse_seen").notNull(), echoSeen: integer("echo_seen"), expiresAt: integer("expires_at").notNull(),
}, t => [index("idx_rooms_expiry").on(t.expiresAt)]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
}, t => [index("idx_rate_limits_expiry").on(t.expiresAt)]);
