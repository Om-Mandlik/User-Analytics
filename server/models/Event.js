const mongoose = require('mongoose');

/**
 * One document per tracked interaction.
 * Flat structure (no nesting) keeps queries and indexes simple.
 *
 *  - url:  full URL as seen in the browser (incl. query/hash)
 *  - page: origin + pathname, used to group events per page (heatmap key)
 *  - x/y:  click position relative to the viewport (clientX/clientY)
 *  - pageX/pageY + pageWidth/pageHeight: position relative to the whole document,
 *    which is what the heatmap uses so scrolled clicks land in the right place.
 */
const eventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    type: { type: String, required: true, enum: ['page_view', 'click'] },
    url: { type: String, required: true },
    page: { type: String, required: true },
    timestamp: { type: Date, required: true },

    title: String,
    referrer: String,

    // click-only fields
    x: Number,
    y: Number,
    pageX: Number,
    pageY: Number,
    pageWidth: Number,
    pageHeight: Number,
    viewportWidth: Number,
    viewportHeight: Number,
    target: String,

    receivedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// sessions list + per-session journey
eventSchema.index({ sessionId: 1, timestamp: 1 });
// heatmap lookups: all clicks for a page
eventSchema.index({ type: 1, page: 1 });
// recent-first session ordering / time-range queries
eventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Event', eventSchema);
