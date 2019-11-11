ConfigSchema = Dry::Validation.Schema do
  configure do
    config.messages_file = File.join(File.dirname(__FILE__), './errors.yml')
    predicates SchemaPredicates
  end

  required('country').filled(:str?, included_in?: %w[US RU JP])
  required('email').filled(:email?)
  required('title').filled(:str?)

  required('baseMsgClipUrl').filled(:str?)
  required('baseSfxClipUrl').filled(:str?)

  required('messenger').schema do
    required('displayTimezones').value(min_size?: 1) { each(:time_zone?) }
    required('mandrill').filled
    required('voxImplant').filled
    required('sender').schema do
      required('email').filled(:email?)
      required('name').filled(:str?)
      required('number').filled(:phone_number?)
    end
  end
end
