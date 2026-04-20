$loginBody = "{\"username\":\"firma\",\"password\":\"1234\",\"loginScope\":\"company-admin\"}"
try {
    $loginResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/login" -Method Post -ContentType "application/json" -Body $loginBody
    "Login Status: $($loginResponse.StatusCode) $($loginResponse.StatusDescription)"
    "Login Body: $($loginResponse.Content)"
    
    $loginData = $loginResponse.Content | ConvertFrom-Json
    if ($loginData.token) {
        $token = $loginData.token
        try {
            $metricsResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/invoices/ops-metrics" -Method Get -Headers @{Authorization = "Bearer $token"}
            "Metrics Status: $($metricsResponse.StatusCode) $($metricsResponse.StatusDescription)"
            "Metrics Body: $($metricsResponse.Content)"
        } catch {
            "Metrics Status Error"
        }
    }
} catch {
    "Login Status Error"
}
