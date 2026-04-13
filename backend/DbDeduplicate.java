import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class DbDeduplicate {
    public static void main(String[] args) throws Exception {
        boolean apply = args.length > 0 && "--apply".equals(args[0]);

        String url = System.getenv().getOrDefault("DB_URL", "jdbc:mariadb://localhost:3306/finance_dashboard");
        String user = System.getenv().getOrDefault("DB_USERNAME", "root");
        String password = System.getenv().getOrDefault("DB_PASSWORD", "");

        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            connection.setAutoCommit(false);

            List<Long> duplicateIds = findDuplicateIds(connection);

            System.out.println("Duplicate rows found: " + duplicateIds.size());
            if (!duplicateIds.isEmpty()) {
                System.out.println("First duplicate ids: " + duplicateIds.stream().limit(20).toList());
            }

            if (!apply) {
                connection.rollback();
                System.out.println("Dry run only. Re-run with --apply to delete duplicates.");
                return;
            }

            if (!duplicateIds.isEmpty()) {
                deleteDuplicates(connection, duplicateIds);
            }

            connection.commit();
            printUserTotals(connection, 1L);
        }
    }

    private static List<Long> findDuplicateIds(Connection connection) throws Exception {
        List<Long> duplicateIds = new ArrayList<>();
        String sql = """
                select id, user_id, amount, type, category, description, date
                from transactions
                order by user_id, date, amount, type, category, description, id
                """;

        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            TransactionKey previous = null;
            while (rs.next()) {
                long id = rs.getLong("id");
                TransactionKey current = new TransactionKey(
                        rs.getLong("user_id"),
                        normalizeAmount(rs.getBigDecimal("amount")),
                        rs.getString("type"),
                        normalizeText(rs.getString("category")),
                        normalizeText(rs.getString("description")),
                        rs.getObject("date", LocalDate.class)
                );

                if (current.equals(previous)) {
                    duplicateIds.add(id);
                } else {
                    previous = current;
                }
            }
        }

        return duplicateIds;
    }

    private static void deleteDuplicates(Connection connection, List<Long> duplicateIds) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("delete from transactions where id = ?")) {
            for (Long id : duplicateIds) {
                statement.setLong(1, id);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void printUserTotals(Connection connection, long userId) throws Exception {
        String sql = """
                select type, count(*) as cnt, sum(amount) as total
                from transactions
                where user_id = ?
                group by type
                order by type
                """;

        System.out.println("Totals after cleanup for user " + userId + ":");
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, userId);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    System.out.printf(
                            "%s | %d | %s%n",
                            rs.getString("type"),
                            rs.getInt("cnt"),
                            rs.getBigDecimal("total")
                    );
                }
            }
        }
    }

    private static BigDecimal normalizeAmount(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount.stripTrailingZeros();
    }

    private static String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private record TransactionKey(
            long userId,
            BigDecimal amount,
            String type,
            String category,
            String description,
            LocalDate date
    ) {
        @Override
        public boolean equals(Object obj) {
            if (!(obj instanceof TransactionKey other)) {
                return false;
            }
            return userId == other.userId
                    && Objects.equals(amount, other.amount)
                    && Objects.equals(type, other.type)
                    && Objects.equals(category, other.category)
                    && Objects.equals(description, other.description)
                    && Objects.equals(date, other.date);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, amount, type, category, description, date);
        }
    }
}
