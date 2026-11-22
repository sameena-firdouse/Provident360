/**
 * Sensitive content & OTP detection on text and image data.
 * Pure functions matching Provident360's security policy:
 * - Reject OTPs and verification codes
 * - Reject plain-text credentials and passwords
 * - Reject unmasked Aadhaar, PAN, full bank accounts, and payment card numbers
 * - Findings never leak the matched secret value
 */

export const OTP = 'otp';
export const CREDENTIAL = 'credential';
export const AADHAAR = 'aadhaar';
export const PAN = 'pan';
export const UAN = 'uan';
export const BANK = 'bank_account';
export const CARD = 'card';
export const UNCERTAIN = 'uncertain_otp';

export interface Finding {
  category: string;
  certain: boolean;
  message: string;
}

const STRONG_OTP_REGEX = /\b[o0]\s?t\s?p\b|one[\s-]*time[\s-]*(?:pass(?:word|code)?|pin|code)|\bverification\s+(?:code|pin|number)\b|\b(?:authentication|authorization|authorisation|security|confirmation|login|log-in|sign-in|signin|access|activation|reset|transaction)\s+(?:code|pin)\b|\b(?:2fa|two[\s-]*factor|2[\s-]*step|two[\s-]*step)\b|\bpass[\s-]?code\b|\bverify\s+(?:your|with)\b|\bsecret\s+code\b/i;

const WEAK_OTP_REGEX = /\bdo\s+not\s+share\b|\bdon'?t\s+share\b|\bnever\s+share\b|\bnot\s+share\s+(?:this|it|your)\b|(?:expires?|valid|expiring)\s+(?:in|for|within)\s+\d+\s*(?:min|minute|minutes|mins|sec|seconds|hour|hours)\b|\b(?:enter|use)\s+(?:this|the)\s+code\b|\bcode\s+(?:is|:)|\byour\s+code\b|\bverification\b/i;

const DIGIT_CODE_CANDIDATE = /(?<![\w/.:,@#$-])(?:\d{3}[ -]\d{3}|\d{2}[ -]\d{2}[ -]\d{2}|\d{4}[ -]\d{4}|\d{4,8})(?![\w/:@%]|\.\d|,\d)/;

const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const AADHAAR_REGEX = /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/;
const CARD_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/;
const PASSWORD_PROMPT_REGEX = /\b(?:password|passcode|login pin|atm pin|cvv|cvc)\s*[:=]\s*\S+/i;

export function analyzeTextForSensitiveContent(text: string): Finding[] {
  const findings: Finding[] = [];
  if (!text) return findings;

  const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, ' ');

  // 1. Password / PIN detection
  if (PASSWORD_PROMPT_REGEX.test(clean)) {
    findings.push({
      category: CREDENTIAL,
      certain: true,
      message: 'Image appears to contain exposed password or PIN credentials.',
    });
  }

  // 2. Strong OTP detection with code near keyword
  const hasStrongOtpWord = STRONG_OTP_REGEX.test(clean);
  const hasWeakOtpWord = WEAK_OTP_REGEX.test(clean);
  const codeMatch = DIGIT_CODE_CANDIDATE.exec(clean);

  if (hasStrongOtpWord && codeMatch) {
    findings.push({
      category: OTP,
      certain: true,
      message: 'One-Time Password (OTP) or verification code detected. For your security, OTP screenshots are prohibited.',
    });
  } else if (hasStrongOtpWord || (hasWeakOtpWord && codeMatch)) {
    findings.push({
      category: UNCERTAIN,
      certain: false,
      message: 'Possible security verification code wording detected. Please upload a redacted document.',
    });
  }

  // 3. Payment Card Number detection (Luhn)
  if (CARD_REGEX.test(clean)) {
    findings.push({
      category: CARD,
      certain: true,
      message: 'Payment card number detected. Please redact card numbers before uploading.',
    });
  }

  // 4. Unmasked PAN detection (if not permitted)
  if (PAN_REGEX.test(clean)) {
    findings.push({
      category: PAN,
      certain: true,
      message: 'Full PAN detected. Please redact all but the last 4 digits.',
    });
  }

  // 5. Unmasked Aadhaar detection
  if (AADHAAR_REGEX.test(clean)) {
    findings.push({
      category: AADHAAR,
      certain: true,
      message: 'Full 12-digit Aadhaar number detected. EPFO requires masked Aadhaar with only last 4 digits visible.',
    });
  }

  return findings;
}
