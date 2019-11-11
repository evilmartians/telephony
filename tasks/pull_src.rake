# frozen_string_literal: true

desc 'Pull VoxImplant scenarios from playground to src/*.js (sync)'
task :pull_src do
  require_relative 'lib/voximplant'

  vox = VoxImplant.new(ENV['VOX_ACCOUNT_ID'], ENV['VOX_API_KEY'])

  all_scenarios = []
  offset = 0

  loop do
    res = vox.get(:GetScenarios, offset: offset, count: 5)
    all_scenarios.concat(res['result'])
    break if all_scenarios.count == res['total_count']
    offset += res['count']
  end

  all_scenarios.each do |scenario|
    filename = "src/#{scenario['scenario_name']}.js"
    next unless File.exists?(filename)
    res = vox.get(:GetScenarios, scenario_id: scenario['scenario_id'], with_script: true)
    script = res.dig('result', 0, 'scenario_script')
    script.gsub!("\r", '')
    File.write(filename, script)
  end
end
