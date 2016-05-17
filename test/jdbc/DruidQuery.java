import java.sql.SQLException;
import java.sql.DriverManager;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.ResultSet;

class DruidQuery
{
  public static void main(String[] args) throws SQLException
  {
    try {
      Connection con = DriverManager.getConnection("jdbc:mysql://127.0.0.1:3307/plyql1");
      Statement stmt = con.createStatement();
      ResultSet rs = stmt.executeQuery(
        "SELECT page, count(*) AS cnt FROM wikipedia GROUP BY page ORDER BY cnt DESC LIMIT 15"
      );

      while (rs.next()) {
        String page = rs.getString("page");
        long count = rs.getLong("cnt");
        System.out.println(String.format("page[%s] count[%d]", page, count));
      }
    } catch (SQLException s) {
      s.printStackTrace();
    }
  }
}
