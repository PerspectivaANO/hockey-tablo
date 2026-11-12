/** Зона по месту в таблице — как в регламенте группы. */
export function zoneOf(z, place) {
  if (!z) return "";
  if (z.promoAuto && z.promoAuto.includes(place)) return "up";
  if (z.qualify && z.qualify.includes(place)) return "qu";
  if (z.playoff && place <= z.playoff) return "po";
  if ((z.promoPlay && z.promoPlay.includes(place)) || (z.relegPlay && z.relegPlay.includes(place))) return "pl";
  if (z.relegAuto && z.relegAuto.includes(place)) return "down";
  return "";
}
