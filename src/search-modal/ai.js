// AI conversation view — a chat thread shown as a pushed detail view. The entry
// holds `thread` (an array of questions); follow-ups append to it (see
// askFollowup in index.js) so the exchange builds up like a real chat.
//
// Styling intentionally mirrors the other detail pages (topic/concept): the same
// `.sm-detail` container/padding, `.sm-section-title` labels, and pill chips.

import { escapeHtml, escapeAttr } from '../lib/dom.js';

export function aiView(ctx, entry) {
  const thread = (entry && entry.thread) || [];
  const lastIdx = thread.length - 1;

  const turns = thread.map((q, i) => {
    const { body, followups } = ctx.ai.buildMessage(q);
    return { q, body, followups: i === lastIdx ? (followups || []) : [] };
  }).map((t) => `
    <div class="sm-chat-turn">
      <div class="sm-chat-q">${escapeHtml(t.q)}</div>
      <div class="sm-chat-a">
        <span class="sm-chat-spark">✦</span>
        <div class="sm-ai-body">${t.body}</div>
      </div>
    </div>`).join('');

  const last = thread.length ? ctx.ai.buildMessage(thread[lastIdx]) : { followups: [] };
  const followups = (last.followups || []).length ? `
    <div class="sm-section sm-chat-followups">
      <h3 class="sm-section-title">Suggested questions</h3>
      <div class="sm-chat-fqs">
        ${last.followups.map((f) => `<button class="sm-chat-fq" data-sm-ai-followup="${escapeAttr(f)}">${escapeHtml(f)}</button>`).join('')}
      </div>
    </div>` : '';

  return `<div class="sm-detail sm-chat">
      ${turns}
      ${followups}
    </div>
    <form class="sm-ai-composer" data-sm-ai-composer>
      <input type="text" placeholder="Ask a follow-up…" autocomplete="off" />
      <button type="submit" class="sm-ai-send" title="Send" aria-label="Send">↑</button>
    </form>`;
}
