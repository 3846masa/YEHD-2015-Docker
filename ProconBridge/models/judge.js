'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Score Schema
 */

const JudgeSchema = new Schema({
  username: { type: String, default: '' },
  question: { type: String, default: '' },
  code: { type: String, default: '' },
  lang: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  submitted: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'submitted' }
});

mongoose.model('Judge', JudgeSchema);
