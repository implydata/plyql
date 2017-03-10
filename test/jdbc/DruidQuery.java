import java.sql.SQLException;
import java.sql.DriverManager;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.ResultSet;
import java.sql.Timestamp;

class DruidQuery
{
  public static void main(String[] args) throws SQLException
  {
    try {
      // args[0] is something like "jdbc:mysql://127.0.0.1:3307/plyql1"
      Connection con = DriverManager.getConnection(args[0]);
      Statement stmt = con.createStatement();
      ResultSet rs = stmt.executeQuery(
        "SELECT DATE_FORMAT(`__time`, '%Y-%m-%d 00:00:00') AS `Time`, `channel` AS `Channel`, `isNew` AS IsNew, SUM(count) AS Count, SUM(`added`)/100 AS 'Added' FROM wikipedia GROUP BY 1, 2, 3 ORDER BY Count DESC LIMIT 5"
      );

      while (rs.next()) {
      	Timestamp time = rs.getTimestamp("Time");
        String channel = rs.getString("Channel");
        long count = rs.getLong("Count");
        float added = rs.getFloat("Added");
        System.out.println(String.format("Time[%s] Channel[%s] Count[%d] Added[%f]", time.toString(), channel, count, added));
      }
    } catch (SQLException s) {
      s.printStackTrace();
    }
  }
}

