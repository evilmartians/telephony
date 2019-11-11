# frozen_string_literal: true

require 'json'
require 'erb'
require 'pp'
require 'dry-validation'

require_relative 'voximplant'
require_relative 'schema_predicates'
require_relative 'address_book_schema'
require_relative 'schedule_schema'
require_relative 'config_schema'

class Deploy
  def initialize(options = {})
    @vox = VoxImplant.new(ENV['VOX_ACCOUNT_ID'], ENV['VOX_API_KEY'])
    @options = options
    @logger = options[:logger]
  end

  def run(&block)
    @push = []

    instance_exec(&block)

    push_all! unless dry?
  ensure
    @push = nil
  end

  private

  def write_production_bundle(zone)
    write_bundle("#{zone}-bundle") do
      write_boot
      write_address_book
      write_config(zone)
      write_schedule(zone)
      write_src
    end
  end

  def write_boot
    script = File.read('src/_boot.js')
    push(:scenario, '_boot', script)
  end

  def write_address_book
    @logger&.info { "Writing address book..." }

    address_book = JSON.parse File.read "address_book.json"

    result = AddressBookSchema.(address_book)

    if result.failure?
      print_schema_messages(address_book, result.messages)
      raise 'AddressBook is not valid!'
    else
      @address_book = address_book
    end

    script = def_json_const(:AddressBook, address_book)
    push(:scenario, 'address_book', script)
  end

  def write_schedule(zone)
    @logger&.info { "Writing '#{zone}' schedule..." }

    schedule = JSON.parse File.read zone_path(zone, 'schedule.json')

    validate_schedule!(zone, schedule)

    name = "schedule.#{zone}"
    script = def_json_const(:Schedule, schedule)
    push(:scenario, name, script)
  end

  def validate_schedule!(zone, schedule)
    available_emails = @address_book.map { |e| e['email'] }

    result = ScheduleSchema.with(available_emails: available_emails).(schedule)
    if result.failure?
      print_schema_messages(schedule, result.errors)
      raise "Schedule '#{zone}' is not valid!"
    end
  end

  def write_config(zone)
    @logger&.info { "Writing '#{zone}' config..." }

    erb = ERB.new(File.read(zone_path(zone, 'config.json.erb')))
    config = JSON.parse(erb.result)

    validate_config!(zone, config)

    name = "config.#{zone}"
    script = def_json_const(:Config, config)
    push(:scenario, name, script)
  end

  def validate_config!(zone, config)
    result = ConfigSchema.call(config)
    if result.failure?
      print_schema_messages(config, result.errors)
      raise "Config '#{zone}' is not valid!"
    end
  end

  def write_bundle(bundle_name)
    @logger&.info { "Writing '#{bundle_name}' bundle..." }

    old_push = @push
    new_push = []

    @push = new_push
    yield
    @push = old_push

    big_script = +"// Bundle: #{bundle_name}\n\n"
    new_push.each do |type, *args|
      raise "Unsupported command within write_bundle: #{type}" unless type == :scenario
      name, script = args
      big_script << "// Scenario: #{name}\n\n"
      big_script << script
      big_script << "\n\n"
    end
    push(:scenario, bundle_name, big_script)

    @logger&.info { "Wrote '#{bundle_name}' bundle!" }
  ensure
    @push = old_push
  end

  def write_src
    Dir.glob('src/*.js').sort.each do |filename|
      @logger&.info { "Writing '#{filename}' script..." }

      name = File.basename(filename, '.js')
      next if name.start_with? '_'
      script = File.read(filename)
      push(:scenario, name, script)
    end
  end

  def print_schema_messages(ary, messages)
    messages.each do |index, messages|
      obj = ary[index]
      puts " * Errorneous entry #{index}:"
      puts JSON.pretty_generate obj
      messages.each do |name, errors|
        puts "+ #{name}:"
        errors && errors.each do |err|
          puts "  - #{err}"
        end
      end
      puts
    end
  end

  def def_json_const(name, obj)
    "run.define('#{name}', () => {\n    return #{JSON.pretty_generate(obj, indent: ' ' * 4)};\n});"
  end

  def push(name, *args)
    @push << [name, *args]
  end

  def push_all!
    @push.each do |type, *args|
      send("push_#{type}!", *args)
    end
  end

  def push_scenario!(name, script)
    @logger&.info { "Pushing '#{name}' scenario..." }

    res = @vox.rewrite_scenario(name, script)
    scenario_id = res['scenario_id']
    @logger&.info { "Pushed scenario #{scenario_id}!" }
  end

  def dry?
    @options.fetch(:dry, false)
  end

  def zone_path(zone, filename)
    "#{zone}-#{filename}"
  end
end
