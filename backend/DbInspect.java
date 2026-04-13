import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class DbInspect {
    public static void main(String[] args) throws Exception {
        String url = System.getenv().getOrDefault("DB_URL", "jdbc:mariadb://localhost:3306/finance_dashboard");
        String user = System.getenv().getOrDefault("DB_USERNAME", "root");
        String password = System.getenv().getOrDefault("DB_PASSWORD", "");

        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {

            System.out.println("USERS");
            try (ResultSet rs = statement.executeQuery(
                    "select id, username from users order by id"
            )) {
                while (rs.next()) {
                    System.out.printf("%d | %s%n", rs.getLong("id"), rs.getString("username"));
                }
            }

            System.out.println();
            System.out.println("TRANSACTION COUNTS");
            try (ResultSet rs = statement.executeQuery(
                    "select user_id, count(*) as cnt, min(date) as min_date, max(date) as max_date " +
                            "from transactions group by user_id order by user_id"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | %d | %s | %s%n",
                            rs.getLong("user_id"),
                            rs.getInt("cnt"),
                            rs.getDate("min_date"),
                            rs.getDate("max_date")
                    );
                }
            }

            System.out.println();
            System.out.println("TYPE TOTALS FOR USER 1");
            try (ResultSet rs = statement.executeQuery(
                    "select type, count(*) as cnt, sum(amount) as total " +
                            "from transactions where user_id = 1 group by type order by type"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%s | %d | %s%n",
                            rs.getString("type"),
                            rs.getInt("cnt"),
                            rs.getBigDecimal("total")
                    );
                }
            }

            System.out.println();
            System.out.println("TYPE TOTALS FOR USER 1 IN IMPORT RANGE");
            try (ResultSet rs = statement.executeQuery(
                    "select type, count(*) as cnt, sum(amount) as total " +
                            "from transactions " +
                            "where user_id = 1 and date >= '2023-03-01' and date <= '2026-03-23' " +
                            "group by type order by type"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%s | %d | %s%n",
                            rs.getString("type"),
                            rs.getInt("cnt"),
                            rs.getBigDecimal("total")
                    );
                }
            }

            System.out.println();
            System.out.println("TOP INCOME CATEGORIES USER 1");
            try (ResultSet rs = statement.executeQuery(
                    "select category, count(*) as cnt, sum(amount) as total " +
                            "from transactions where user_id = 1 and type = 'INCOME' " +
                            "group by category order by total desc limit 15"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%s | %d | %s%n",
                            rs.getString("category"),
                            rs.getInt("cnt"),
                            rs.getBigDecimal("total")
                    );
                }
            }

            System.out.println();
            System.out.println("TOP EXPENSE CATEGORIES USER 1");
            try (ResultSet rs = statement.executeQuery(
                    "select category, count(*) as cnt, sum(amount) as total " +
                            "from transactions where user_id = 1 and type = 'EXPENSE' " +
                            "group by category order by total desc limit 15"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%s | %d | %s%n",
                            rs.getString("category"),
                            rs.getInt("cnt"),
                            rs.getBigDecimal("total")
                    );
                }
            }

            System.out.println();
            System.out.println("LARGEST INCOME ROWS USER 1");
            try (ResultSet rs = statement.executeQuery(
                    "select id, date, amount, category, left(description, 120) as description " +
                            "from transactions where user_id = 1 and type = 'INCOME' " +
                            "order by amount desc limit 20"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | %s | %s | %s | %s%n",
                            rs.getLong("id"),
                            rs.getDate("date"),
                            rs.getBigDecimal("amount"),
                            rs.getString("category"),
                            rs.getString("description")
                    );
                }
            }

            System.out.println();
            System.out.println("LARGEST EXPENSE ROWS USER 1");
            try (ResultSet rs = statement.executeQuery(
                    "select id, date, amount, category, left(description, 120) as description " +
                            "from transactions where user_id = 1 and type = 'EXPENSE' " +
                            "order by amount desc limit 20"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | %s | %s | %s | %s%n",
                            rs.getLong("id"),
                            rs.getDate("date"),
                            rs.getBigDecimal("amount"),
                            rs.getString("category"),
                            rs.getString("description")
                    );
                }
            }

            System.out.println();
            System.out.println("LONG CATEGORIES");
            try (ResultSet rs = statement.executeQuery(
                    "select id, user_id, char_length(category) as len, category " +
                            "from transactions where char_length(category) > 80 order by char_length(category) desc limit 20"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | user %d | len %d | %s%n",
                            rs.getLong("id"),
                            rs.getLong("user_id"),
                            rs.getInt("len"),
                            rs.getString("category")
                    );
                }
            }

            System.out.println();
            System.out.println("LONG DESCRIPTIONS");
            try (ResultSet rs = statement.executeQuery(
                    "select id, user_id, char_length(description) as len " +
                            "from transactions where description is not null and char_length(description) > 255 " +
                            "order by char_length(description) desc limit 20"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | user %d | len %d%n",
                            rs.getLong("id"),
                            rs.getLong("user_id"),
                            rs.getInt("len")
                    );
                }
            }

            System.out.println();
            System.out.println("NULL OR EMPTY CHECK");
            try (ResultSet rs = statement.executeQuery(
                    "select " +
                            "sum(case when category is null or category = '' then 1 else 0 end) as bad_category, " +
                            "sum(case when date is null then 1 else 0 end) as bad_date, " +
                            "sum(case when amount is null then 1 else 0 end) as bad_amount " +
                            "from transactions"
            )) {
                if (rs.next()) {
                    System.out.printf(
                            "bad_category=%d | bad_date=%d | bad_amount=%d%n",
                            rs.getInt("bad_category"),
                            rs.getInt("bad_date"),
                            rs.getInt("bad_amount")
                    );
                }
            }

            System.out.println();
            System.out.println("SUBSCRIPTIONS");
            try (ResultSet rs = statement.executeQuery(
                    "select id, user_id, name, monthly_cost from subscriptions order by user_id, id"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | user %d | %s | %s%n",
                            rs.getLong("id"),
                            rs.getLong("user_id"),
                            rs.getString("name"),
                            rs.getBigDecimal("monthly_cost")
                    );
                }
            }

            System.out.println();
            System.out.println("ASSETS");
            try (ResultSet rs = statement.executeQuery(
                    "select id, user_id, name, asset_value from assets order by user_id, id"
            )) {
                while (rs.next()) {
                    System.out.printf(
                            "%d | user %d | %s | %s%n",
                            rs.getLong("id"),
                            rs.getLong("user_id"),
                            rs.getString("name"),
                            rs.getBigDecimal("asset_value")
                    );
                }
            }
        }
    }
}
