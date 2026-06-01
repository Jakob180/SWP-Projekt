package com.Budeget_Tracker.demo.service;

import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SchemaMigrationService {
    private static final Logger log = LoggerFactory.getLogger(SchemaMigrationService.class);

    private final DataSource dataSource;

    public SchemaMigrationService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void ensureUserColumnsExist() {
        try (Connection connection = dataSource.getConnection()) {
            if (!hasColumn(connection, "users", "email")) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL");
                    log.info("Added users.email column");
                }
            }

            if (!hasColumn(connection, "users", "role")) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'");
                    log.info("Added users.role column");
                }
            }

            try (Statement statement = connection.createStatement()) {
                statement.execute("""
                        UPDATE users u
                        JOIN user_login_profiles p ON p.username = u.username
                        SET u.email = p.email
                        WHERE u.email IS NULL OR u.email = ''
                        """);
                statement.execute("""
                        UPDATE users
                        SET role = 'ADMIN'
                        WHERE LOWER(username) = 'admin'
                        """);
            }
        } catch (Exception ex) {
            log.warn("Schema migration for users failed: {}", ex.getMessage());
        }
    }

    private boolean hasColumn(Connection connection, String tableName, String columnName) throws Exception {
        DatabaseMetaData metaData = connection.getMetaData();
        try (ResultSet resultSet = metaData.getColumns(null, null, tableName, columnName)) {
            return resultSet.next();
        }
    }
}
