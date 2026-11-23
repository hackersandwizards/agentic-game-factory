import Phaser from "phaser";
import { COLOR, HW, REDUCED, TEAL, TEXT, TEXT_SCALE, TINT } from "../design/tokens";
import { formatClock, rank, rankTips, recordImprovements, winAwards } from "../domain/score";
import { INVITE_BAND } from "./bands";
import type { Bands } from "./bands";

const RIGHT = 176; // the panel's right edge, in its unscaled coordinates
/** How far into the view from its left edge the panel reaches, in px. */
export const WIN_PANEL_REACH = RIGHT * TEXT_SCALE;
const WORDMARK_TEAL = "#1f889f";
const WIZARD_PURPLE = "#a453ed";
const TIP_LABELS = {
  crystals: "CRYSTALS",
  secret: "SECRET",
  chains: "CHAINS",
  unhurt: "NO HITS",
  speed: "SPEED",
};
// The win panel's lines appear one by one: the first as the panel lands, then one every LINE_MS.
const LINE_START = 1000;
const LINE_MS = 150;
type ScoredRun = Parameters<typeof rankTips>[0];
type WinScore = ScoredRun & { kills: number };
// A win's time, awards and the browser's records it met.
type AwardSummary = {
  time: number;
  best: number;
  bestScore: number;
  gold: boolean;
  awards: ReturnType<typeof winAwards>;
};
type PanelLine = [string, string, ((count: number) => string)?, number?];

export function nextRankLines(run: ScoredRun, gold: boolean): [string, string][] {
  const above = rankTips(run, gold);
  if (!above) return [];
  // Each gets its own line so "TRY" does not wrap away from its suggestions.
  return [
    [`RANK ${above.rank} AT ${above.minimum}:`, HW.ampersand],
    [above.tips.map((key) => TIP_LABELS[key]).join(", "), COLOR.amber],
  ];
}

/** The win's panel: the run's awards, score, rank and records, line by line. */
export class WinPanel {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showScore(run: WinScore, summary: AwardSummary, touch: boolean, bands: Bands) {
    const { time, best, bestScore } = summary;
    const improved = recordImprovements(time, run.score, best, bestScore);
    const record: [string, string] = improved.length
      ? [`NEW BEST ${improved.join(", ").toUpperCase()}`, COLOR.gold]
      : [`BEST ${bestScore} ${rank(bestScore)}, ${formatClock(best)}`, HW.ampersand];

    this.drawPanel(this.lines(run, summary, record, touch), bands);
  }

  private lines(
    run: WinScore,
    { time, gold, awards }: AwardSummary,
    record: [string, string],
    touch: boolean,
  ): PanelLine[] {
    // The panel slides in on the left, so the laptop, the wizard and the fountain stay in view. Each line is
    // its text and colour, and a line that counts up also how it shows a count, and its points.
    // 20 letters fill the panel: the label left, the points right, the longest label two letters clear of them.
    const tally = (label: string) => (points: number | string) =>
      `${label.padEnd(20 - String(points).length)}${points}`;
    const labels = {
      crystals: [
        `CRYSTALS ${run.crystals}/${run.totalCrystals}`,
        run.crystals === run.totalCrystals ? COLOR.gold : COLOR.crystal,
      ],
      secret: ["SECRET CRYSTAL", WIZARD_PURPLE],
      // A chain of one is no chain: "BUGS 3 CHAIN 1" read as a second count.
      bugs: [`BUGS ${run.kills}${run.longestChain > 1 ? ` CHAIN ${run.longestChain}` : ""}`, COLOR.amber],
      unhurt: ["NO HITS", COLOR.green],
      time: [`TIME ${formatClock(time)}`, COLOR.gold],
    };
    return [
      ["MERRY CHRISTMAS", COLOR.snow],
      ["HACKERS", WORDMARK_TEAL],
      ...awards.map(([key, points]): PanelLine => {
        const [label, color] = labels[key];
        // Name each way to earn points. A missed award shows a dim dash, where "+0" read like a reward.
        return [tally(label)(points || "-"), points ? color : COLOR.dim, tally(label), points];
      }),
      [
        `SCORE ${run.score} RANK ${rank(run.score)}`,
        COLOR.crystal,
        (count: number) => `SCORE ${count}`,
        run.score,
      ],
      ...nextRankLines(run, gold),
      record,
      [touch ? "TAP TO PLAY AGAIN" : "ENTER: PLAY AGAIN", COLOR.snow],
    ];
  }

  private drawPanel(lines: PanelLine[], bands: Bands) {
    // Upright the same lines go to the band above the canvas: monospaced and 20 letters each, the points line up there
    // too. The best and the tap to play again lead the band below: on a 320x568 phone the twelve lines started 8 px
    // from the screen's top, 2.8 px apart.
    const band = lines.map(([text, color]): [string, string][] => [[text, color]]);
    // The panel ends 2 px above the footer, its lines 5 px inside its edge and up to 14 px apart, GAME OVER's pitch: at
    // 9 px, a pixel between lines, they read as a wall.
    const pitch = Math.min(14, Math.floor(110 / (lines.length - 1)));
    const height = 18 + (lines.length - 1) * pitch;
    const panel = this.scene.add
      .container(0, (-height - 8) * TEXT_SCALE)
      .setScale(TEXT_SCALE)
      .setDepth(40)
      .setName("panel");
    panel.add(
      this.scene.add
        .rectangle(4, 4, RIGHT - 4, height, TINT.outline, 0.9)
        .setOrigin(0)
        .setStrokeStyle(1, TEAL),
    );
    // The wordmark in the h&w colours (teal, amp grey, purple), lifted just enough to read 4.5:1 on the dark panel.
    // The font is monospaced at 8 px, so "&" starts 7 letters in.
    const amp = this.scene.add.text(66, 9 + pitch, "", { ...TEXT, color: HW.ampersand });
    const wizards = this.scene.add.text(74, 9 + pitch, "", { ...TEXT, color: WIZARD_PURPLE });
    panel.add([amp, wizards]);
    // Twelve lines at once read as a wall: once the panel is in, they appear one by one, every points line
    // counting up from 0, and the panel is done (data "done", which the tests wait for) after the last.
    lines.forEach(([text, color, format, points], i) => {
      const line = panel.add(this.scene.add.text(10, 9 + i * pitch, "", { ...TEXT, color }))
        .last as Phaser.GameObjects.Text;
      this.scene.time.delayedCall(LINE_START + i * LINE_MS, () => {
        if (i === 1) [amp.text, wizards.text] = ["&", "WIZARDS"];
        if (!format || !points) return line.setText(text);
        this.scene.tweens.addCounter({
          to: points,
          duration: LINE_MS,
          onUpdate: (tween) => line.setText(format(Math.round(tween.getValue() ?? 0))),
          onComplete: () => line.setText(text),
        });
      });
    });
    this.scene.time.delayedCall(LINE_START + lines.length * LINE_MS, () => panel.setData("done", true));
    bands.band(panel);
    band[1].push(["&", HW.ampersand], ["WIZARDS", WIZARD_PURPLE]);
    bands.words("above", band.slice(0, -2));
    bands.words("below", [...band.slice(-2), ...INVITE_BAND]);
    this.scene.tweens.add({ targets: panel, y: 0, duration: 500, delay: 700, ease: "Quart.out" });
    // The last line, how to play again, pulses gently and stays readable.
    if (!REDUCED)
      this.scene.tweens.add({
        targets: panel.list.at(-1),
        alpha: 0.7,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
  }
}
