VALID_SCHEDULE_KEYS = %w[All Mon Tue Wed Thu Fri Sat Sun].freeze

ScheduleSchema = Dry::Validation.Schema do
  configure do
    config.messages_file = File.join(File.dirname(__FILE__), './errors.yml')
    predicates SchemaPredicates
    option :available_emails
  end

  each do
    schema do
      required('email').filled(:email?, included_in?: available_emails)

      required('timeZone').filled(:time_zone?)

      required('schedule').schema do
        VALID_SCHEDULE_KEYS.each do |key|
          optional(key) { valid_working_hours? }
        end
      end
    end
  end
end
