module.exports = {
  // When rent is due each month
  rent_due_day: 1,

  // Grace period before late fees apply
  grace_period_days: 5,

  // Flat late fee applied on day 6
  late_fee_base: 50,

  // Additional daily fee kicks in after this day
  daily_fee_after_day: 15,
  daily_fee_amount: 10,

  // Auto-escalation threshold
  auto_escalation_day: 10,

  // Pay-or-quit cure period (Maine Title 14 §6002)
  pay_or_quit_cure_days: 7,

  // Day triggers for collection actions
  reminder_1_day: 1,
  reminder_2_day: 3,
  late_fee_day: 5,
  reminder_3_day: 7,
  escalation_day: 10,

  // Cron expressions
  cron_monthly: '0 0 1 * *',   // midnight on the 1st
  cron_daily: '0 9 * * *',     // 9 AM daily
};
