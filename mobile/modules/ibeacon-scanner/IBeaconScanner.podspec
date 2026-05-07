Pod::Spec.new do |s|
  s.name         = "IBeaconScanner"
  s.version      = "0.1.0"
  s.summary      = "Local iOS iBeacon scanner via CLLocationManager (Apple's iBeacon ranging API)."
  s.homepage     = "https://example.com/local"
  s.license      = "MIT"
  s.author       = { "Unplgd" => "local@unplgd" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.frameworks   = "CoreLocation", "Foundation"

  install_modules_dependencies(s)
end
