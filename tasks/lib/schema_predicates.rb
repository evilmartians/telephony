module SchemaPredicates
  include Dry::Logic::Predicates

  require 'tzinfo'

  EMAIL_REGEX = /\A([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]+)\z/
  PHONE_REGEX = /\+\d{7}/

  predicate(:email?) do |value|
    str?(value) && !EMAIL_REGEX.match(value).nil?
  end

  predicate(:phone_number?) do |value|
    str?(value) && !PHONE_REGEX.match(value).nil?
  end

  predicate(:time_zone?) do |value|
    str?(value) && included_in?(TZInfo::Timezone.all_identifiers, value)
  end

  predicate(:valid_working_hours?) do |working_hours|
    working_hours == false ||
      working_hours == nil ||
      (
        working_hours.is_a?(Array) &&
          working_hours.size == 2 &&
          (0..24).cover?(working_hours[0]) &&
          (0..24).cover?(working_hours[1]) &&
          (working_hours[1] > working_hours[0])
      )
  end
end
