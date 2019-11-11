namespace :deploy do
  deploy = proc do |&block|
    require_relative 'lib/deploy'
    logger = Logger.new(STDOUT)
    Deploy.new(
      logger: logger,
      dry: ENV['DEPLOY_DRY_RUN'] == '1'
    ).run(&block)
  end

  desc 'Deploy bundle for the sample zone'
  task :zone do
    deploy.call { write_production_bundle('zone') }
  end

  desc 'Deploy all'
  task all: [
    :zone
  ]
end
