import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;

public class TokenGen {
    public static void main(String[] args) {
        String subject = args.length > 0 ? args[0] : "Jakob";
        String jwtSecret = System.getenv().getOrDefault(
                "JWT_SECRET",
                "super-secret-key-change-me-super-secret-key-change-me"
        );

        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        try {
            byte[] decoded = Decoders.BASE64.decode(jwtSecret);
            if (decoded.length >= 32) {
                keyBytes = decoded;
            }
        } catch (RuntimeException ignored) {
            // Keep UTF-8 bytes fallback
        }

        if (keyBytes.length < 32) {
            keyBytes = Arrays.copyOf(keyBytes, 32);
        }

        Instant now = Instant.now();
        String token = Jwts.builder()
                .subject(subject)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(86400)))
                .signWith(Keys.hmacShaKeyFor(keyBytes))
                .compact();

        System.out.println(token);
    }
}
