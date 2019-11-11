# frozen_string_literal: true

require 'net/http'
require 'json'

class VoxImplant
  def initialize(account_id, api_key)
    @account_id = account_id
    @api_key = api_key
  end

  def post(cmd, data)
    res = Net::HTTP.post_form(cmd_uri(cmd), with_auth_params(data))
    parse_response!(res)
  end

  def get(cmd, params)
    uri = cmd_uri(cmd)
    uri.query = URI.encode_www_form(with_auth_params(params))
    res = Net::HTTP.get_response(uri)
    parse_response!(res)
  end

  def rewrite_scenario(name, script)
    post :AddScenario,
         scenario_name: name,
         scenario_script: script,
         rewrite: true
  end

  private

  def cmd_uri(cmd)
    URI.join("https://api.voximplant.com/platform_api/", cmd.to_s)
  end

  def with_auth_params(data)
    data.merge(account_id: @account_id, api_key: @api_key)
  end

  def parse_response!(res)
    if res.is_a? Net::HTTPSuccess
      body = JSON.parse res.body
      error = body['error']
      if error
        raise "VoxImplant API error: #{error.to_json}"
      else
        body
      end
    else
      raise "VoxImplant HTTP error (#{res.code}): #{res.body}"
    end
  end
end
