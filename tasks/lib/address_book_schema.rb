AddressBookSchema = Dry::Validation.Schema do
  configure do
    config.messages_file = File.join(File.dirname(__FILE__), './errors.yml')
    predicates SchemaPredicates
  end

  each do
    schema do
      required('email').filled(:email?)
      required('ext').filled(:str?, format?: /\A\d\d\d\z/)
      required('name').filled(:str?)
      required('number').filled(:phone_number?)
    end
  end
end
